package edu.kgisl.attendance

import android.app.Application
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class App : Application() {
  lateinit var store: SessionStore private set
  lateinit var api: AttendanceApi private set
  lateinit var diagnostics: DiagnosticsStore private set

  /** Single worker keeps API calls ordered and token refresh race-free. */
  val worker: ExecutorService = Executors.newSingleThreadExecutor()

  override fun onCreate() {
    super.onCreate()
    store = SessionStore(this)
    api = AttendanceApi(store)
    diagnostics = DiagnosticsStore(this)
  }
}
