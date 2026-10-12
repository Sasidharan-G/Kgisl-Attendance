package edu.kgisl.attendance

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context

class BleBeaconScanner(context: Context, private val onPacket: (String, Int) -> Unit) {
  private val adapter = context.getSystemService(BluetoothAdapter::class.java)
  private val scanner get() = adapter?.bluetoothLeScanner
  private val callback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val data = result.scanRecord?.getManufacturerSpecificData(BuildConfig.BEACON_MANUFACTURER_ID)
      BeaconPacket.fromManufacturerData(data)?.let { onPacket(it, result.rssi) }
    }
  }

  @SuppressLint("MissingPermission")
  fun start(): Boolean {
    val bleScanner = scanner ?: return false
    val filter = ScanFilter.Builder().setManufacturerData(BuildConfig.BEACON_MANUFACTURER_ID, byteArrayOf(0x4b, 1)).build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    bleScanner.startScan(listOf(filter), settings, callback)
    return true
  }

  @SuppressLint("MissingPermission")
  fun stop() { scanner?.stopScan(callback) }
}
