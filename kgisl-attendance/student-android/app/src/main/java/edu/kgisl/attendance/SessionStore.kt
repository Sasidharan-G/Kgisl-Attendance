package edu.kgisl.attendance

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionStore(context: Context) {
  private val preferences = EncryptedSharedPreferences.create(
    context,
    "kgisl_secure_session",
    MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  var backendUrl: String
    get() = preferences.getString("backend_url", null) ?: BuildConfig.API_BASE_URL
    set(value) = preferences.edit().putString("backend_url", value.trim().trimEnd('/')).apply()
  var accessToken: String?
    get() = preferences.getString("access_token", null)
    set(value) = preferences.edit().putString("access_token", value).apply()
  var refreshToken: String?
    get() = preferences.getString("refresh_token", null)
    set(value) = preferences.edit().putString("refresh_token", value).apply()
  var studentName: String?
    get() = preferences.getString("student_name", null)
    set(value) = preferences.edit().putString("student_name", value).apply()
  var rollNo: String?
    get() = preferences.getString("roll_no", null)
    set(value) = preferences.edit().putString("roll_no", value).apply()

  val isSignedIn: Boolean get() = !refreshToken.isNullOrEmpty()

  /** Drops credentials but keeps the backend URL so a debug override survives sign-out. */
  fun clearSession() {
    preferences.edit().remove("access_token").remove("refresh_token").remove("student_name").remove("roll_no").apply()
  }
}
