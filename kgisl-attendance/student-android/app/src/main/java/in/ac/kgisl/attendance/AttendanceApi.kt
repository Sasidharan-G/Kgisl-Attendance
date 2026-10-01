package edu.kgisl.attendance

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class AttendanceApi(private val store: SessionStore) {
  private val client = OkHttpClient()
  private val jsonType = "application/json".toMediaType()

  fun login(baseUrl: String, email: String, password: String): JSONObject {
    val body = JSONObject().put("email", email).put("password", password)
    val result = execute(baseUrl, "/api/v1/auth/student/login", body, null)
    store.backendUrl = baseUrl.trimEnd('/')
    store.accessToken = result.getString("token")
    store.refreshToken = result.getString("refreshToken")
    return result.getJSONObject("user")
  }

  fun submitBeacon(packet: String, rssi: Int, deviceId: String, lat: Double, lng: Double, accuracy: Float): JSONObject {
    val body = JSONObject()
      .put("packet", packet)
      .put("rssi", rssi)
      .put("deviceId", deviceId)
      .put("gps", JSONObject().put("lat", lat).put("lng", lng).put("accuracy", accuracy.toDouble()))
    return authenticated("/api/v1/scan/beacon", body)
  }

  private fun authenticated(path: String, body: JSONObject): JSONObject {
    val baseUrl = store.backendUrl ?: throw IOException("Backend URL is missing")
    try { return execute(baseUrl, path, body, store.accessToken) }
    catch (error: HttpStatusException) {
      if (error.status != 401) throw error
      val refresh = store.refreshToken ?: throw error
      val refreshed = execute(baseUrl, "/api/v1/auth/refresh", JSONObject().put("refreshToken", refresh), null).getJSONObject("data")
      store.accessToken = refreshed.getString("accessToken")
      store.refreshToken = refreshed.getString("refreshToken")
      return execute(baseUrl, path, body, store.accessToken)
    }
  }

  private fun execute(baseUrl: String, path: String, body: JSONObject, token: String?): JSONObject {
    val builder = Request.Builder().url(baseUrl.trimEnd('/') + path).post(body.toString().toRequestBody(jsonType))
    token?.let { builder.header("Authorization", "Bearer $it") }
    client.newCall(builder.build()).execute().use { response ->
      val text = response.body?.string().orEmpty()
      val json = runCatching { JSONObject(text) }.getOrElse { JSONObject().put("message", text) }
      if (!response.isSuccessful) throw HttpStatusException(response.code, json.optString("message", "Request failed"))
      return json
    }
  }
}

class HttpStatusException(val status: Int, message: String) : IOException(message)
