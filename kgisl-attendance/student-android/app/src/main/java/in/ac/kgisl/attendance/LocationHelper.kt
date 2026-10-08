package edu.kgisl.attendance

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject

data class GpsFix(val lat: Double, val lng: Double, val accuracy: Float) {
  fun toJson(): JSONObject = JSONObject().put("lat", lat).put("lng", lng).put("accuracy", accuracy.toDouble())
}

/**
 * Keeps GPS warm while the student is on the attendance screen so a good fix already exists by the
 * time a beacon or QR is detected. The fix with the smallest reported error among recent samples is
 * used; mock-provider and stale locations are ignored. Nothing here changes the server's geofence
 * rules; it only supplies the most accurate reading the phone can produce.
 */
class LocationHelper(context: Context) {
  private class Sample(val fix: GpsFix, val at: Long)
  private class Waiter(val goodEnough: Float, val maxAgeMs: Long, val onDone: (GpsFix?) -> Unit) { var done = false }

  private val client = LocationServices.getFusedLocationProviderClient(context)
  private val handler = Handler(Looper.getMainLooper())
  private val samples = ArrayDeque<Sample>()
  private val waiters = mutableListOf<Waiter>()
  private var callback: LocationCallback? = null

  /** Starts continuous high-accuracy updates (idempotent). */
  @SuppressLint("MissingPermission")
  fun start() {
    if (callback != null) return
    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1_000)
      .setMinUpdateIntervalMillis(500)
      .setWaitForAccurateLocation(true)
      .build()
    val cb = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        val now = SystemClock.elapsedRealtime()
        for (location in result.locations) {
          if (isMock(location) || !location.hasAccuracy() || location.accuracy <= 0f) continue
          samples.addLast(Sample(GpsFix(location.latitude, location.longitude, location.accuracy), now))
        }
        while (samples.isNotEmpty() && now - samples.first().at > 30_000) samples.removeFirst()
        waiters.toList().forEach { evaluate(it, force = false) }
      }
    }
    callback = cb
    client.requestLocationUpdates(request, cb, Looper.getMainLooper())
  }

  /**
   * Returns the best recent fix as soon as it is within [goodEnoughMeters]; otherwise keeps sampling
   * until [maxWaitMs] and returns the best available (null if the phone produced none).
   */
  fun bestFix(maxWaitMs: Long = 10_000, goodEnoughMeters: Float = 15f, maxAgeMs: Long = 20_000, onDone: (GpsFix?) -> Unit) {
    start()
    val waiter = Waiter(goodEnoughMeters, maxAgeMs, onDone)
    waiters += waiter
    if (evaluate(waiter, force = false)) return
    handler.postDelayed({ evaluate(waiter, force = true) }, maxWaitMs)
  }

  private fun best(maxAgeMs: Long): GpsFix? {
    val now = SystemClock.elapsedRealtime()
    return samples.filter { now - it.at <= maxAgeMs }.minByOrNull { it.fix.accuracy }?.fix
  }

  private fun evaluate(waiter: Waiter, force: Boolean): Boolean {
    if (waiter.done) return true
    val candidate = best(waiter.maxAgeMs)
    if (!force && (candidate == null || candidate.accuracy > waiter.goodEnough)) return false
    waiter.done = true
    waiters.remove(waiter)
    waiter.onDone(candidate)
    return true
  }

  private fun isMock(location: Location): Boolean =
    if (Build.VERSION.SDK_INT >= 31) location.isMock else @Suppress("DEPRECATION") location.isFromMockProvider

  /** Stops updates and drops pending requests without invoking their callbacks. */
  fun stop() {
    handler.removeCallbacksAndMessages(null)
    waiters.clear()
    callback?.let { client.removeLocationUpdates(it) }
    callback = null
    samples.clear()
  }
}
