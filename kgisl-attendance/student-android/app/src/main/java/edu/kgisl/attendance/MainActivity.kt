package edu.kgisl.attendance

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import edu.kgisl.attendance.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private val app get() = application as App

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!app.store.isSignedIn) { returnToLogin(); return }

    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)
    setSupportActionBar(binding.toolbar)

    binding.bottomNav.setOnItemSelectedListener { item ->
      show(when (item.itemId) {
        R.id.nav_history -> HistoryFragment()
        R.id.nav_leave -> LeaveFragment()
        else -> MarkFragment()
      })
      true
    }
    if (savedInstanceState == null) binding.bottomNav.selectedItemId = R.id.nav_mark
  }

  private fun show(fragment: Fragment) {
    supportFragmentManager.beginTransaction().replace(R.id.container, fragment).commit()
  }

  override fun onCreateOptionsMenu(menu: Menu): Boolean {
    menuInflater.inflate(R.menu.toolbar_menu, menu)
    return true
  }

  override fun onOptionsItemSelected(item: MenuItem): Boolean {
    if (item.itemId != R.id.action_sign_out) return super.onOptionsItemSelected(item)
    app.worker.execute {
      app.api.logout()
      runOnUiThread { returnToLogin() }
    }
    return true
  }

  fun returnToLogin() {
    startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
    finish()
  }
}
