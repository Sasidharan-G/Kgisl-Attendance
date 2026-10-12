package edu.kgisl.attendance

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import edu.kgisl.attendance.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {
  private lateinit var binding: ActivityLoginBinding
  private val app get() = application as App

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (app.store.isSignedIn) { openMain(); return }

    binding = ActivityLoginBinding.inflate(layoutInflater)
    setContentView(binding.root)
    if (BuildConfig.DEBUG) {
      binding.backendUrlLayout.visibility = View.VISIBLE
      binding.backendUrl.setText(app.store.backendUrl)
    }
    binding.login.setOnClickListener { login() }
    binding.password.setOnEditorActionListener { _, _, _ -> login(); true }
  }

  private fun login() {
    val email = binding.email.text.toString().trim()
    val password = binding.password.text.toString()
    if (email.isEmpty() || password.isEmpty()) { showError("Enter your email and password."); return }
    if (BuildConfig.DEBUG) binding.backendUrl.text.toString().takeIf { it.isNotBlank() }?.let { app.store.backendUrl = it }

    setBusy(true)
    app.worker.execute {
      runCatching { app.api.login(email, password) }
        .onSuccess { runOnUiThread { openMain() } }
        .onFailure { error -> runOnUiThread { setBusy(false); showError(ErrorMessages.of(error)) } }
    }
  }

  private fun setBusy(busy: Boolean) {
    binding.login.isEnabled = !busy
    binding.progress.visibility = if (busy) View.VISIBLE else View.GONE
    if (busy) binding.error.visibility = View.GONE
  }

  private fun showError(message: String) {
    binding.error.text = message
    binding.error.visibility = View.VISIBLE
  }

  private fun openMain() {
    startActivity(Intent(this, MainActivity::class.java))
    finish()
  }
}
