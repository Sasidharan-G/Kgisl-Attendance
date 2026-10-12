package edu.kgisl.attendance

import android.content.Context
import android.provider.Settings

/** Stable per-device identifier used for the backend's one-device-per-student binding. */
object DeviceId {
  fun get(context: Context): String =
    Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown-device"
}
