package edu.kgisl.attendance

import java.io.IOException

/** Maps backend error codes to short, student-facing messages. */
object ErrorMessages {
  private val messages = mapOf(
    "QR_EXPIRED" to "That QR code has expired. Scan the latest QR shown by your faculty.",
    "INVALID_QR_SIGNATURE" to "Invalid QR code. Scan the QR displayed by your faculty.",
    "TOKEN_REVOKED" to "That QR code is no longer valid. Scan the latest one.",
    "TOKEN_ALREADY_USED" to "That QR code was already used.",
    "ATTENDANCE_ALREADY_MARKED" to "Your attendance is already marked for this session.",
    "BATCH_MISMATCH" to "You are not enrolled in this session's batch.",
    "SUBJECT_MISMATCH" to "Subject does not match this session.",
    "OUTSIDE_ALLOWED_LOCATION" to "You are outside the allowed attendance location.",
    "DEVICE_NOT_AUTHORIZED" to "This phone is not authorised for your account. Ask your faculty to reset your device.",
    "GPS_ACCURACY_TOO_LOW" to "GPS accuracy is too low. Move near a window or outdoors and retry.",
    "GPS_REQUIRED" to "Precise location is required to mark attendance.",
    "SESSION_NOT_ACTIVE" to "This attendance session is not active.",
    "OUTSIDE_TIME_WINDOW" to "The attendance window has closed for this session.",
    "BEACON_PACKET_INVALID_OR_EXPIRED" to "The classroom beacon signal expired. Stay in class; the app will use the next signal.",
    "BEACON_TOKEN_INVALID_OR_EXPIRED" to "The classroom beacon signal expired. Stay in class; the app will use the next signal.",
    "BEACON_NOT_FOUND" to "This classroom beacon is not registered. Inform your faculty.",
    "BEACON_ROOM_MISMATCH" to "This beacon does not belong to the session's classroom.",
    "BEACON_SIGNAL_TOO_WEAK" to "Beacon signal is too weak. Move closer to the classroom board.",
    "PASSWORD_CHANGE_REQUIRED" to "Set a new password first: sign in on the KGiSL website once, choose a new password, then sign in here again.",
    "RATE_LIMITED" to "Too many attempts. Wait a moment and try again.",
    "INVALID_CREDENTIALS" to "Incorrect email or password.",
    "ACCOUNT_INACTIVE" to "Your account is inactive. Contact your administrator.",
    "SESSION_EXPIRED" to "Your session expired. Please sign in again.",
  )

  /** Codes where retrying can never succeed, so the UI should stop rather than keep scanning. */
  private val permanent = setOf(
    "ATTENDANCE_ALREADY_MARKED", "DEVICE_NOT_AUTHORIZED", "PASSWORD_CHANGE_REQUIRED", "BATCH_MISMATCH",
    "SESSION_NOT_ACTIVE", "OUTSIDE_TIME_WINDOW", "SESSION_EXPIRED",
  )

  fun of(error: Throwable): String = when (error) {
    is ApiException -> messages[error.code] ?: error.message ?: "Request failed"
    is IOException -> "No connection to the server. Check your internet and retry."
    else -> error.message ?: "Something went wrong."
  }

  fun isPermanent(error: Throwable): Boolean = error is ApiException && error.code in permanent
  fun isSessionExpired(error: Throwable): Boolean = error is ApiException && error.code == "SESSION_EXPIRED"
}
