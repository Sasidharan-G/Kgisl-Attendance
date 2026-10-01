package edu.kgisl.attendance

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import edu.kgisl.attendance.databinding.ActivityMainBinding
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private lateinit var store: SessionStore
  private lateinit var api: AttendanceApi
  private lateinit var scanner: BleBeaconScanner
  private lateinit var diagnostics: DiagnosticsStore
  private val stabilityGate = BeaconStabilityGate()
  private val worker = Executors.newSingleThreadExecutor()
  private val submitted = LinkedHashSet<String>()

  private val permissionRequest = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
    if (result.values.all { it }) startScanner() else show("Bluetooth/location permission is required")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)
    store = SessionStore(this)
    api = AttendanceApi(store)
    diagnostics = DiagnosticsStore(this)
    scanner = BleBeaconScanner(this) { packet, rssi ->
      stabilityGate.observe(packet, rssi)?.let { stableRssi -> runOnUiThread { receivePacket(packet, stableRssi) } }
    }
    binding.backendUrl.setText(store.backendUrl ?: "")
    binding.scan.isEnabled = store.accessToken != null
    if (BuildConfig.DEBUG) {
      binding.mockPacket.visibility = View.VISIBLE
      binding.submitMock.visibility = View.VISIBLE
    }
    binding.login.setOnClickListener { login() }
    binding.scan.setOnClickListener { requestScanPermissions() }
    binding.submitMock.setOnClickListener {
      val packet = binding.mockPacket.text.toString().trim()
      if (BeaconPacket.isValidText(packet)) receivePacket(packet, -50) else show("Invalid mock packet")
    }
  }

  private fun login() {
    show("Signing in…")
    worker.execute {
      runCatching { api.login(binding.backendUrl.text.toString(), binding.email.text.toString(), binding.password.text.toString()) }
        .onSuccess { user -> runOnUiThread { binding.scan.isEnabled = true; show("Welcome ${user.optString("name")}. Ready to scan.") } }
        .onFailure { runOnUiThread { show(it.message ?: "Login failed") } }
    }
  }

  private fun requestScanPermissions() {
    val locationPermissions = arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)
    val permissions = if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, *locationPermissions)
      else locationPermissions
    if (permissions.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }) startScanner()
    else permissionRequest.launch(permissions)
  }

  private fun startScanner() {
    if (scanner.start()) show("Scanning for classroom beacon…") else show("Enable Bluetooth and retry")
  }

  private fun receivePacket(packet: String, rssi: Int) {
    if (!submitted.add(packet)) return
    val issuedAt = BeaconPacket.issuedAtMillis(packet)
    if (issuedAt == null || System.currentTimeMillis() - issuedAt !in -3_000L..30_000L) {
      submitted.remove(packet); diagnostics.record("LOCAL_PACKET_EXPIRED", rssi); show("Expired beacon ignored"); return
    }
    while (submitted.size > 20) submitted.remove(submitted.first())
    show("Beacon detected ($rssi dBm). Getting GPS…")
    val locationClient = LocationServices.getFusedLocationProviderClient(this)
    val cancellation = CancellationTokenSource()
    @Suppress("MissingPermission")
    locationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token).addOnSuccessListener { location ->
      if (location == null) { submitted.remove(packet); show("GPS fix unavailable. Enable precise location and retry."); return@addOnSuccessListener }
      worker.execute {
        val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        runCatching { submitWithShortRetry(packet, rssi, deviceId, location.latitude, location.longitude, location.accuracy, issuedAt + 30_000L) }
          .onSuccess { result -> runOnUiThread { scanner.stop(); show(result.optString("message", "Attendance marked")) } }
          .onFailure { error -> runOnUiThread { diagnostics.record("SUBMIT_FAILED", rssi); submitted.remove(packet); show(error.message ?: "Attendance failed") } }
      }
    }
  }

  private fun submitWithShortRetry(packet: String, rssi: Int, deviceId: String, lat: Double, lng: Double, accuracy: Float, deadline: Long): org.json.JSONObject {
    var delayMs = 500L
    while (true) {
      try { return api.submitBeacon(packet, rssi, deviceId, lat, lng, accuracy) }
      catch (error: Exception) {
        val retryable = error !is HttpStatusException || error.status >= 500
        if (!retryable || System.currentTimeMillis() + delayMs >= deadline) throw error
        diagnostics.record("NETWORK_RETRY", rssi)
        Thread.sleep(delayMs)
        delayMs = minOf(delayMs * 2, 4_000L)
      }
    }
  }

  private fun show(message: String) { binding.status.text = message }
  override fun onDestroy() { scanner.stop(); worker.shutdown(); super.onDestroy() }
}
