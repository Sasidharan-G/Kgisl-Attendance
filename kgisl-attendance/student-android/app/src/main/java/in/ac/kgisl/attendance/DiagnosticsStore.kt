package edu.kgisl.attendance

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Keeps only privacy-safe event codes; packets, GPS, credentials and names are never logged. */
class DiagnosticsStore(context: Context) {
  private val preferences = context.getSharedPreferences("kgisl_diagnostics", Context.MODE_PRIVATE)

  @Synchronized fun record(code: String, rssi: Int? = null) {
    val events = runCatching { JSONArray(preferences.getString("events", "[]")) }.getOrDefault(JSONArray())
    events.put(JSONObject().put("at", System.currentTimeMillis()).put("code", code).also { if (rssi != null) it.put("rssi", rssi) })
    val trimmed = JSONArray()
    for (index in maxOf(0, events.length() - 50) until events.length()) trimmed.put(events.get(index))
    preferences.edit().putString("events", trimmed.toString()).apply()
  }
}
