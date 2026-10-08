package edu.kgisl.attendance

import android.graphics.Color
import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import com.google.android.material.datepicker.MaterialDatePicker
import edu.kgisl.attendance.databinding.FragmentLeaveBinding
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Submit leave / on-duty requests and track their review status. */
class LeaveFragment : Fragment(R.layout.fragment_leave) {
  private var views: FragmentLeaveBinding? = null
  private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
  private var from = dateFormat.format(Date())
  private var to = from

  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    val b = FragmentLeaveBinding.bind(view)
    views = b
    b.typeGroup.check(R.id.typeLeave)
    b.refresh.setOnRefreshListener { load() }
    b.fromDate.setOnClickListener { pickDate(from) { from = it; if (to < from) to = from; renderDates() } }
    b.toDate.setOnClickListener { pickDate(to) { to = it; if (to < from) from = to; renderDates() } }
    b.submit.setOnClickListener { submit() }
    renderDates()
    load()
  }

  private fun renderDates() {
    views?.fromDate?.text = "From $from"
    views?.toDate?.text = "To $to"
  }

  private fun pickDate(current: String, onPicked: (String) -> Unit) {
    val picker = MaterialDatePicker.Builder.datePicker()
      .setSelection(runCatching { dateFormat.parse(current)!!.time }.getOrDefault(MaterialDatePicker.todayInUtcMilliseconds()))
      .build()
    picker.addOnPositiveButtonClickListener { onPicked(dateFormat.format(Date(it))) }
    picker.show(childFragmentManager, "date")
  }

  private fun submit() {
    val b = views ?: return
    val reason = b.reason.text.toString().trim()
    if (reason.length < 5) { b.formStatus.text = "Reason must be at least 5 characters."; return }
    val type = if (b.typeGroup.checkedButtonId == R.id.typeOnDuty) "ON_DUTY" else "LEAVE"
    b.submit.isEnabled = false
    b.formStatus.text = "Submitting…"
    app.worker.execute {
      runCatching { app.api.createLeave(type, from, to, reason) }
        .onSuccess { ui { views?.let { v -> v.submit.isEnabled = true; v.reason.setText(""); v.formStatus.text = "Request submitted." }; load() } }
        .onFailure { error -> ui { views?.let { v -> v.submit.isEnabled = true; v.formStatus.text = failure(error) } } }
    }
  }

  private fun load() {
    views?.refresh?.isRefreshing = true
    app.worker.execute {
      runCatching { app.api.leaveRequests() }
        .onSuccess { list -> ui { render(list) } }
        .onFailure { error -> ui { views?.refresh?.isRefreshing = false; views?.formStatus?.text = failure(error) } }
    }
  }

  private fun render(requests: JSONArray) {
    val b = views ?: return
    b.refresh.isRefreshing = false
    b.list.removeAllViews()
    if (requests.length() == 0) addNote(b.list, "No requests yet.")
    for (i in 0 until requests.length()) {
      val request = requests.getJSONObject(i)
      val status = request.optString("status")
      val note = request.optString("reviewNote").takeIf { it.isNotBlank() && it != "null" }
      addRow(
        b.list,
        request.optString("type").replace('_', ' ') + " · " + formatApiTime(request.optString("fromDate"), "dd MMM") + " – " + formatApiTime(request.optString("toDate"), "dd MMM"),
        request.optString("reason") + (note?.let { "\nReviewer: $it" } ?: ""),
        status,
        when (status) { "APPROVED" -> Color.parseColor("#0F766E"); "REJECTED" -> Color.parseColor("#B3261E"); else -> Color.parseColor("#B26A00") },
      )
    }
  }

  override fun onDestroyView() { views = null; super.onDestroyView() }
}
