package edu.kgisl.attendance

import org.json.JSONObject
import java.util.Base64

/** Reads claims from the access token the server issued. The signature is checked by the server, never here. */
object JwtClaims {
  /**
   * True while the account still uses its initial password. The server then rejects every call except "change
   * password", which this app does not have, so the student has to do it once on the website first.
   */
  fun requiresPasswordChange(token: String): Boolean = runCatching {
    val payload = token.split('.')[1]
    val json = JSONObject(String(Base64.getUrlDecoder().decode(payload), Charsets.UTF_8))
    json.optBoolean("mcp", false)
  }.getOrDefault(false)
}
