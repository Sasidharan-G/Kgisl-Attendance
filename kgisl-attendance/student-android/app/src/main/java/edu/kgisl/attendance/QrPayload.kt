package edu.kgisl.attendance

import org.json.JSONObject

/** The signed, rotating payload encoded in the faculty QR. Only these six fields are accepted by the API. */
data class QrPayload(
  val sessionId: String,
  val token: String,
  val issuedAt: Long,
  val expiresAt: Long,
  val nonce: String,
  val signature: String,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("sessionId", sessionId).put("token", token)
    .put("issuedAt", issuedAt).put("expiresAt", expiresAt)
    .put("nonce", nonce).put("signature", signature)

  companion object {
    /** Returns null for anything that is not a complete attendance QR (e.g. an unrelated QR code). */
    fun parse(raw: String): QrPayload? = runCatching {
      val json = JSONObject(raw)
      QrPayload(
        sessionId = json.getString("sessionId"),
        token = json.getString("token"),
        issuedAt = json.getLong("issuedAt"),
        expiresAt = json.getLong("expiresAt"),
        nonce = json.getString("nonce"),
        signature = json.getString("signature"),
      ).takeIf { it.sessionId.isNotBlank() && it.token.isNotBlank() && it.nonce.isNotBlank() && it.signature.isNotBlank() }
    }.getOrNull()
  }
}
