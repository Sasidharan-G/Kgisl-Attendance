package edu.kgisl.attendance

import android.util.Base64

object BeaconPacket {
  const val BINARY_LENGTH = 21
  const val TEXT_LENGTH = 28

  fun fromManufacturerData(data: ByteArray?): String? {
    if (data == null || data.size != BINARY_LENGTH || data[0] != 0x4b.toByte() || data[1] != 1.toByte()) return null
    return Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
      .takeIf { it.length == TEXT_LENGTH }
  }

  fun isValidText(packet: String): Boolean =
    packet.length == TEXT_LENGTH && packet.matches(Regex("^[A-Za-z0-9_-]{28}$")) && runCatching {
      val data = Base64.decode(packet, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
      data.size == BINARY_LENGTH && data[0] == 0x4b.toByte() && data[1] == 1.toByte()
    }.getOrDefault(false)

  fun issuedAtMillis(packet: String): Long? = runCatching {
    if (!isValidText(packet)) return null
    val data = Base64.decode(packet, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    ((data[4].toLong() and 0xff) shl 24 or
      ((data[5].toLong() and 0xff) shl 16) or
      ((data[6].toLong() and 0xff) shl 8) or
      (data[7].toLong() and 0xff)) * 1000L
  }.getOrNull()
}
