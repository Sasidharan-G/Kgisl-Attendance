package edu.kgisl.attendance

import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import edu.kgisl.attendance.databinding.ItemRowBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal val Fragment.app: App get() = requireActivity().application as App

/** Runs [block] on the UI thread only if the fragment's view still exists. */
internal fun Fragment.ui(block: () -> Unit) {
  activity?.runOnUiThread { if (isAdded && view != null) block() }
}

/** Routes an API error to the user; an expired session sends them back to sign in. */
internal fun Fragment.failure(error: Throwable): String {
  if (ErrorMessages.isSessionExpired(error)) (activity as? MainActivity)?.returnToLogin()
  return ErrorMessages.of(error)
}

internal fun addRow(parent: ViewGroup, title: String, subtitle: String, trailing: String, trailingColor: Int? = null) {
  val row = ItemRowBinding.inflate(LayoutInflater.from(parent.context), parent, false)
  row.title.text = title
  row.subtitle.text = subtitle
  row.trailing.text = trailing
  if (trailingColor != null) row.trailing.setTextColor(trailingColor)
  parent.addView(row.root)
}

internal fun addHeading(parent: ViewGroup, text: String) {
  parent.addView(TextView(parent.context).apply {
    this.text = text
    textSize = 18f
    setTypeface(typeface, android.graphics.Typeface.BOLD)
    setPadding(0, 16, 0, 12)
  })
}

internal fun addNote(parent: ViewGroup, text: String) {
  parent.addView(TextView(parent.context).apply { this.text = text; alpha = 0.7f; setPadding(0, 8, 0, 8) })
}

private fun parseIso(value: String?): Date? {
  if (value.isNullOrBlank()) return null
  val formats = listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")
  for (pattern in formats) {
    val parsed = runCatching {
      SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(value)
    }.getOrNull()
    if (parsed != null) return parsed
  }
  return null
}

/** Formats an ISO-8601 UTC timestamp from the API in the phone's local time. */
internal fun formatApiTime(value: String?, pattern: String = "dd MMM, hh:mm a"): String =
  parseIso(value)?.let { SimpleDateFormat(pattern, Locale.getDefault()).format(it) } ?: "—"
