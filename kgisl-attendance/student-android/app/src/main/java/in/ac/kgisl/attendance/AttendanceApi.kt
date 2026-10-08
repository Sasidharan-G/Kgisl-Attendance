package edu.kgisl.attendance

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Backend error: [code] is the stable machine code (e.g. QR_EXPIRED), [message] is server text. */
class ApiException(val status: Int, val code: String, message: String) : IOException(message)

class AttendanceApi(private val store: SessionStore) {
  private val client = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
    .build()
  private val jsonType = "application/json".toMediaType()

  fun login(email: String, password: String): JSONObject {
    val body = JSONObject().put("email", email.trim()).put("password", password)
    val result = send("POST", "/api/v1/auth/student/login", body, null)
    val user = result.getJSONObject("user")
    store.accessToken = result.getString("token")
    store.refreshToken = result.getString("refreshToken")
    store.studentName = user.optString("name")
    store.rollNo = user.optString("rollNo")
    return user
  }

  fun logout() {
    val refresh = store.refreshToken
    store.clearSession()
    if (refresh != null) runCatching { send("POST", "/api/v1/auth/logout", JSONObject().put("refreshToken", refresh), null) }
  }

  fun submitBeacon(packet: String, rssi: Int, deviceId: String, fix: GpsFix): JSONObject =
    authenticated("POST", "/api/v1/scan/beacon", JSONObject()
      .put("packet", packet)
      .put("rssi", rssi)
      .put("deviceId", deviceId)
      .put("gps", fix.toJson()))

  fun sessionPublicInfo(sessionId: String): JSONObject =
    authenticated("GET", "/api/v1/sessions/$sessionId/public", null).getJSONObject("data")

  fun submitQr(qr: QrPayload, batchId: String, subjectId: String, deviceId: String, fix: GpsFix): JSONObject =
    authenticated("POST", "/api/v1/scan", JSONObject()
      .put("batchId", batchId)
      .put("subjectId", subjectId)
      .put("deviceId", deviceId)
      .put("gps", fix.toJson())
      .put("qr", qr.toJson()))

  fun myAttendance(): JSONObject =
    authenticated("GET", "/api/v1/students/me/attendance", null).getJSONObject("data")

  fun leaveRequests(): JSONArray =
    authenticated("GET", "/api/v1/leave-requests", null).getJSONArray("data")

  fun createLeave(type: String, fromDate: String, toDate: String, reason: String): JSONObject =
    authenticated("POST", "/api/v1/leave-requests", JSONObject()
      .put("type", type).put("fromDate", fromDate).put("toDate", toDate).put("reason", reason))

  private fun authenticated(method: String, path: String, body: JSONObject?): JSONObject {
    try {
      return send(method, path, body, store.accessToken)
    } catch (error: ApiException) {
      if (error.status != 401) throw error
    }
    refreshTokens()
    return send(method, path, body, store.accessToken)
  }

  @Synchronized
  private fun refreshTokens() {
    val refresh = store.refreshToken ?: throw ApiException(401, "SESSION_EXPIRED", "Please sign in again.")
    try {
      val pair = send("POST", "/api/v1/auth/refresh", JSONObject().put("refreshToken", refresh), null).getJSONObject("data")
      store.accessToken = pair.getString("accessToken")
      store.refreshToken = pair.getString("refreshToken")
    } catch (error: ApiException) {
      if (error.status in 400..499) {
        store.clearSession()
        throw ApiException(401, "SESSION_EXPIRED", "Your session expired. Please sign in again.")
      }
      throw error
    }
  }

  private fun send(method: String, path: String, body: JSONObject?, token: String?): JSONObject {
    val builder = Request.Builder().url(store.backendUrl + path)
    if (method == "GET") builder.get() else builder.method(method, (body ?: JSONObject()).toString().toRequestBody(jsonType))
    token?.let { builder.header("Authorization", "Bearer $it") }
    client.newCall(builder.build()).execute().use { response ->
      val text = response.body?.string().orEmpty()
      val json = runCatching { JSONObject(text) }.getOrElse { JSONObject().put("message", text.take(200)) }
      if (!response.isSuccessful) {
        throw ApiException(response.code, json.optString("code", "HTTP_${response.code}"), json.optString("message", "Request failed"))
      }
      return json
    }
  }
}
