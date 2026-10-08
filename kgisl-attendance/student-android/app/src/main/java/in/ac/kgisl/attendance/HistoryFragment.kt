package edu.kgisl.attendance

import android.graphics.Color
import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import edu.kgisl.attendance.databinding.FragmentListBinding
import org.json.JSONObject

/** Per-subject attendance percentage plus the recent session-by-session record. */
class HistoryFragment : Fragment(R.layout.fragment_list) {
  private var views: FragmentListBinding? = null

  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    views = FragmentListBinding.bind(view).also { it.refresh.setOnRefreshListener { load() } }
    load()
  }

  private fun load() {
    views?.refresh?.isRefreshing = true
    app.worker.execute {
      runCatching { app.api.myAttendance() }
        .onSuccess { data -> ui { render(data) } }
        .onFailure { error -> ui { showMessage(failure(error)) } }
    }
  }

  private fun showMessage(message: String) {
    val b = views ?: return
    b.refresh.isRefreshing = false
    b.content.removeAllViews()
    addNote(b.content, message)
  }

  private fun render(data: JSONObject) {
    val b = views ?: return
    b.refresh.isRefreshing = false
    b.content.removeAllViews()

    val student = data.getJSONObject("student")
    addNote(b.content, "${student.optString("name")} · ${student.optString("rollNo")} · ${student.optString("batchName")}")

    addHeading(b.content, "Subjects")
    val subjects = data.getJSONArray("subjects")
    if (subjects.length() == 0) addNote(b.content, "No classes recorded yet.")
    for (i in 0 until subjects.length()) {
      val subject = subjects.getJSONObject(i)
      val shortage = subject.optBoolean("shortage")
      addRow(
        b.content,
        subject.optString("name"),
        "${subject.optString("code")} · ${subject.optInt("present")}/${subject.optInt("total")} classes" + if (shortage) " · below 75%" else "",
        "${subject.optInt("percentage")}%",
        if (shortage) Color.parseColor("#B3261E") else Color.parseColor("#0F766E"),
      )
    }

    addHeading(b.content, "Recent sessions")
    val sessions = data.getJSONArray("sessions")
    if (sessions.length() == 0) addNote(b.content, "No sessions yet.")
    for (i in 0 until minOf(sessions.length(), 60)) {
      val session = sessions.getJSONObject(i)
      val status = session.optString("status")
      val method = session.optString("method").takeIf { it.isNotBlank() && it != "null" }
      addRow(
        b.content,
        session.optString("subjectName"),
        formatApiTime(session.optString("startedAt")) + (method?.let { " · ${methodLabel(it)}" } ?: ""),
        status.replace('_', ' '),
        if (status in setOf("PRESENT", "LATE", "ON_DUTY")) Color.parseColor("#0F766E") else Color.parseColor("#B3261E"),
      )
    }
  }

  private fun methodLabel(method: String) = when (method) {
    "BEACON" -> "Alpha · Bluetooth"
    "QR" -> "Beta · QR"
    "FACULTY_MANUAL" -> "Marked by faculty"
    else -> method
  }

  override fun onDestroyView() { views = null; super.onDestroyView() }
}
