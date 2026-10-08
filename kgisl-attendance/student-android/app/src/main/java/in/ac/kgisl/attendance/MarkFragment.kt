package edu.kgisl.attendance

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import edu.kgisl.attendance.databinding.FragmentMarkBinding
import org.json.JSONObject

/** Alpha: classroom BLE beacon (primary). Beta: faculty QR code (fallback). */
class MarkFragment : Fragment(R.layout.fragment_mark) {
  private enum class Mode { ALPHA, BETA }

  private var views: FragmentMarkBinding? = null
  private lateinit var scanner: BleBeaconScanner
  private lateinit var location: LocationHelper
  private val gate = BeaconStabilityGate()
  private val submitted = LinkedHashSet<String>()
  private var mode = Mode.ALPHA
  private var scanning = false
  private var busy = false
  private var pendingAction: (() -> Unit)? = null

  private val permissionRequest = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
    if (grants.values.all { it }) { pendingAction?.invoke() } else setStatus("Bluetooth and precise location permissions are required.")
    pendingAction = null
  }

  private val qrRequest = registerForActivityResult(ScanContract()) { result ->
    val contents = result.contents ?: return@registerForActivityResult
    onQr(contents)
  }

  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    val b = FragmentMarkBinding.bind(view)
    views = b
    scanner = BleBeaconScanner(requireContext()) { packet, rssi ->
      gate.observe(packet, rssi)?.let { stableRssi -> ui { onBeacon(packet, stableRssi) } }
    }
    location = LocationHelper(requireContext())

    b.greeting.text = "Hello, ${app.store.studentName ?: "Student"}"
    b.rollNo.text = app.store.rollNo?.let { "Roll no. $it" } ?: ""
    b.modeGroup.check(R.id.modeAlpha)
    b.modeGroup.addOnButtonCheckedListener { _, id, checked ->
      if (!checked) return@addOnButtonCheckedListener
      stopBeaconScan()
      mode = if (id == R.id.modeAlpha) Mode.ALPHA else Mode.BETA
      render()
    }
    b.action.setOnClickListener { onAction() }
    if (BuildConfig.DEBUG) {
      b.debugPacket.visibility = View.VISIBLE
      b.debugSubmit.visibility = View.VISIBLE
      b.debugSubmit.setOnClickListener {
        val packet = b.debugPacket.text.toString().trim()
        if (BeaconPacket.isValidText(packet)) startSubmit { fix -> app.api.submitBeacon(packet, -50, DeviceId.get(requireContext()), fix) }
        else setStatus("Invalid mock packet")
      }
    }
    render()
  }

  private fun render(clearStatus: Boolean = true) {
    val b = views ?: return
    b.result.visibility = View.GONE
    b.progress.visibility = View.GONE
    when (mode) {
      Mode.ALPHA -> {
        b.modeHint.text = "Stay inside the classroom. Your phone detects the classroom Bluetooth beacon and marks attendance automatically. Keep Bluetooth and Location on."
        b.action.text = if (scanning) "Stop scanning" else "Start classroom scan"
        if (clearStatus) setStatus(if (scanning) "Scanning for the classroom beacon…" else "")
      }
      Mode.BETA -> {
        b.modeHint.text = "Use this if Bluetooth is unavailable. Scan the rotating QR code shown by your faculty."
        b.action.text = "Scan QR code"
        if (clearStatus) setStatus("")
      }
    }
  }

  private fun onAction() {
    if (busy) return
    when (mode) {
      Mode.ALPHA -> if (scanning) { stopBeaconScan(); render() } else withPermissions(blePermissions()) { startBeaconScan() }
      Mode.BETA -> withPermissions(locationPermissions()) { launchQr() }
    }
  }

  private fun locationPermissions() = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

  private fun blePermissions(): Array<String> =
    if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, *locationPermissions()) else locationPermissions()

  private fun withPermissions(permissions: Array<String>, action: () -> Unit) {
    if (permissions.all { ContextCompat.checkSelfPermission(requireContext(), it) == PackageManager.PERMISSION_GRANTED }) action()
    else { pendingAction = action; permissionRequest.launch(permissions) }
  }

  // ---- Alpha: BLE beacon -------------------------------------------------------------------

  private fun startBeaconScan() {
    val adapter = requireContext().getSystemService(BluetoothAdapter::class.java)
    if (adapter == null || !adapter.isEnabled) { setStatus("Turn on Bluetooth and try again."); return }
    if (!scanner.start()) { setStatus("Could not start Bluetooth scanning. Turn Bluetooth off and on, then retry."); return }
    scanning = true
    location.start() // warm GPS up so a precise fix is ready when the beacon is seen
    render()
  }

  private fun stopBeaconScan() {
    scanner.stop()
    scanning = false
    if (!busy) location.stop()
  }

  private fun onBeacon(packet: String, rssi: Int) {
    if (busy || !submitted.add(packet)) return
    val issuedAt = BeaconPacket.issuedAtMillis(packet)
    if (issuedAt == null || System.currentTimeMillis() - issuedAt !in -3_000L..30_000L) {
      app.diagnostics.record("LOCAL_PACKET_EXPIRED", rssi)
      return
    }
    while (submitted.size > 20) submitted.remove(submitted.first())
    setStatus("Beacon detected ($rssi dBm). Getting your location…")
    startSubmit(onFailure = { error ->
      app.diagnostics.record("SUBMIT_FAILED", rssi)
      // Transient failures (expired signal, weak RSSI, network) retry on the next beacon packet.
      if (!ErrorMessages.isPermanent(error)) submitted.remove(packet)
      if (ErrorMessages.isPermanent(error)) stopBeaconScan()
    }) { fix -> app.api.submitBeacon(packet, rssi, DeviceId.get(requireContext()), fix) }
  }

  // ---- Beta: QR ----------------------------------------------------------------------------

  private fun launchQr() {
    val options = ScanOptions()
      .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
      .setPrompt("Point the camera at the QR code on the board")
      .setBeepEnabled(false)
      .setOrientationLocked(false)
    location.start() // warm GPS up while the camera is scanning
    qrRequest.launch(options)
  }

  private fun onQr(contents: String) {
    val payload = QrPayload.parse(contents)
    if (payload == null) { setStatus("That is not a KGiSL attendance QR code."); return }
    if (busy) return
    busy = true
    setBusy(true, "Verifying session and location…")

    // Session lookup and GPS run in parallel so the rotating QR does not expire while we wait.
    var session: JSONObject? = null
    var gps: GpsFix? = null
    var pending = 2
    var failed = false
    fun fail(message: String) {
      if (failed) return
      failed = true
      busy = false
      location.stop()
      setBusy(false, message)
    }
    fun join() {
      pending -= 1
      if (pending > 0 || failed) return
      val info = session ?: return fail("Could not verify the session. Retry.")
      val fix = gps ?: return fail("Could not get your location. Turn on precise location and retry.")
      setBusy(true, "Marking attendance…")
      app.worker.execute {
        runCatching { app.api.submitQr(payload, info.getString("batchId"), info.getString("subjectId"), DeviceId.get(requireContext()), fix) }
          .onSuccess { ui { busy = false; showSuccess(it.getJSONObject("data")) } }
          .onFailure { error -> ui { busy = false; setBusy(false, failure(error)) } }
      }
    }
    app.worker.execute {
      runCatching { app.api.sessionPublicInfo(payload.sessionId) }
        .onSuccess { value -> ui { session = value; join() } }
        .onFailure { error -> ui { fail(failure(error)) } }
    }
    location.bestFix { result -> ui { gps = result; join() } }
  }

  // ---- Shared submit path ------------------------------------------------------------------

  /** Gets the best GPS fix, then submits via [call] on the worker thread. */
  private fun startSubmit(onFailure: (Throwable) -> Unit = {}, call: (GpsFix) -> JSONObject) {
    if (busy) return
    busy = true
    setBusy(true, "Getting your location…")
    location.bestFix { fix ->
      ui {
        if (fix == null) {
          busy = false
          onFailure(IllegalStateException("gps"))
          setBusy(false, if (scanning) "Could not get your location. Still scanning…" else "Could not get your location. Turn on precise location and retry.")
          return@ui
        }
        setBusy(true, "Marking attendance…")
        app.worker.execute {
          runCatching { call(fix) }
            .onSuccess { ui { busy = false; stopBeaconScan(); showSuccess(it.getJSONObject("data")) } }
            .onFailure { error ->
              ui {
                busy = false
                onFailure(error)
                val message = failure(error)
                setBusy(false, if (scanning) "$message\nStill scanning…" else message)
                render(clearStatus = false)
              }
            }
        }
      }
    }
  }

  private fun showSuccess(data: JSONObject) {
    val b = views ?: return
    scanning = false
    location.stop()
    b.progress.visibility = View.GONE
    b.action.text = if (mode == Mode.ALPHA) "Start classroom scan" else "Scan QR code"
    setStatus("Attendance marked ✔")
    b.result.visibility = View.VISIBLE
    b.result.text = buildString {
      append(data.optString("subjectName")).append('\n')
      append("Status: ").append(data.optString("status")).append(" (").append(data.optString("method")).append(")\n")
      append("Time: ").append(formatApiTime(data.optString("markedAt"), "hh:mm:ss a")).append('\n')
      append("Distance from class: ").append(data.optInt("distanceMeters")).append(" m")
    }
  }

  private fun setBusy(busy: Boolean, message: String) {
    views?.progress?.visibility = if (busy) View.VISIBLE else View.GONE
    setStatus(message)
    if (!busy && !scanning) location.stop() // QR flow finished; stop GPS to save battery
  }

  private fun setStatus(message: String) { views?.status?.text = message }

  override fun onDestroyView() {
    stopBeaconScan()
    location.stop()
    views = null
    super.onDestroyView()
  }
}
