package edu.kgisl.attendance

/**
 * The offset between the phone's clock and the server's clock, learned from the HTTP `Date` header of every API
 * response. Beacon packets carry the *server's* issue time, so judging their freshness with the phone's own clock
 * silently rejected every packet on a phone whose time was a few seconds off (manual time, no network time).
 */
object ServerClock {
  @Volatile private var offsetMs: Long = 0L
  @Volatile var calibrated: Boolean = false
    private set

  /**
   * @param serverMillis the server time from the `Date` header (whole-second resolution)
   * @param receivedAtMillis the phone's clock when the response arrived
   */
  fun observe(serverMillis: Long, receivedAtMillis: Long) {
    // The header is truncated to whole seconds, so the real server time is on average half a second later.
    offsetMs = serverMillis + 500 - receivedAtMillis
    calibrated = true
  }

  /** Current server time according to the last calibration (the phone's time until it has been calibrated). */
  fun now(localMillis: Long = System.currentTimeMillis()): Long = localMillis + offsetMs

  internal fun reset() {
    offsetMs = 0L
    calibrated = false
  }
}
