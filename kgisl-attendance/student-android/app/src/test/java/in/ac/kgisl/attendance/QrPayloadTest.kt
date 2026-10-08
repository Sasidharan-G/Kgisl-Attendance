package edu.kgisl.attendance

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class QrPayloadTest {
  private val valid = """{"sessionId":"0b6f5b9e-9f0b-4a52-9a4e-1d6a3b2f4c11","token":"abcdefghijklmnopqrstuvwxyz012345","issuedAt":1790000000000,"expiresAt":1790000030000,"nonce":"0123456789abcdef0123456789abcdef","signature":"c2lnbmF0dXJlLXNpZ25hdHVyZQ"}"""

  @Test fun parsesAFullAttendanceQr() {
    val payload = QrPayload.parse(valid)
    assertNotNull(payload)
    assertEquals(1790000030000L, payload!!.expiresAt)
  }

  @Test fun roundTripsOnlyTheSixSignedFields() {
    val json = QrPayload.parse(valid)!!.toJson()
    assertEquals(6, json.length())
  }

  @Test fun rejectsUnrelatedOrIncompleteQrCodes() {
    assertNull(QrPayload.parse("https://example.com"))
    assertNull(QrPayload.parse("""{"sessionId":"x"}"""))
    assertNull(QrPayload.parse(valid.replace("\"nonce\":\"0123456789abcdef0123456789abcdef\"", "\"nonce\":\"\"")))
  }
}
