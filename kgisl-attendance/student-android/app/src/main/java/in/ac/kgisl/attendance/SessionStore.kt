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
  var backendUrl: String?
    get() = preferences.getString("backend_url", null)
    set(value) = preferences.edit().putString("backend_url", value).apply()
  var accessToken: String?
    get() = preferences.getString("access_token", null)
    set(value) = preferences.edit().putString("access_token", value).apply()
  var refreshToken: String?
    get() = preferences.getString("refresh_token", null)
    set(value) = preferences.edit().putString("refresh_token", value).apply()
}
