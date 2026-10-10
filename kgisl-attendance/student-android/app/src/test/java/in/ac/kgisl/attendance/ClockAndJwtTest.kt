package edu.kgisl.attendance

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

class ClockAndJwtTest {
  @After fun resetClock() = ServerClock.reset()

  private fun token(payloadJson: String): String {
    val encoder = Base64.getUrlEncoder().withoutPadding()
    fun part(text: String) = encoder.encodeToString(text.toByteArray(Charsets.UTF_8))
    return "${part("""{"alg":"HS256"}""")}.${part(payloadJson)}.signature"
  }

  @Test fun serverClockCorrectsAPhoneThatIsRunningFast() {
    // The phone believes it is 10 s ahead of the server (header truncated to the second).
    ServerClock.observe(serverMillis = 1_000_000L, receivedAtMillis = 1_010_000L)
    assertTrue(ServerClock.calibrated)
    // 5 s later on the phone the server clock reads about 5.5 s after the header time, not 15 s.
    assertEquals(1_005_500L, ServerClock.now(localMillis = 1_015_000L))
  }

  @Test fun anUncalibratedClockFallsBackToThePhoneClock() {
    assertFalse(ServerClock.calibrated)
    assertEquals(42_000L, ServerClock.now(localMillis = 42_000L))
  }

  @Test fun packetFreshnessUsesTheSameWindowAsTheBackend() {
    val issuedAt = 100_000L
    assertTrue(BeaconPacket.isFresh(issuedAt, issuedAt))
    assertTrue(BeaconPacket.isFresh(issuedAt, issuedAt + 30_000L))
    assertFalse(BeaconPacket.isFresh(issuedAt, issuedAt + 30_001L))
    assertTrue(BeaconPacket.isFresh(issuedAt, issuedAt - 3_000L))
    assertFalse(BeaconPacket.isFresh(issuedAt, issuedAt - 3_001L))
  }

  @Test fun aPhoneClockThatIsFortySecondsFastStillAcceptsAFreshPacketOnceCalibrated() {
    val issuedAt = 2_000_000L
    val phoneNow = issuedAt + 5_000L + 40_000L // the phone is 40 s ahead of the server
    assertFalse(BeaconPacket.isFresh(issuedAt, phoneNow))
    ServerClock.observe(serverMillis = issuedAt + 4_500L, receivedAtMillis = phoneNow)
    assertTrue(BeaconPacket.isFresh(issuedAt, ServerClock.now(localMillis = phoneNow)))
  }

  @Test fun initialPasswordSessionsAreRecognisedFromTheTokenClaim() {
    assertTrue(JwtClaims.requiresPasswordChange(token("""{"sub":"s1","role":"STUDENT","mcp":true}""")))
    assertFalse(JwtClaims.requiresPasswordChange(token("""{"sub":"s1","role":"STUDENT"}""")))
    assertFalse(JwtClaims.requiresPasswordChange(token("""{"sub":"s1","mcp":false}""")))
    assertFalse(JwtClaims.requiresPasswordChange("not-a-token"))
  }

  @Test fun passkeyAndInactiveAccountsStopTheScanLoopWithAReadableMessage() {
    val passkey = ApiException(403, "PASSKEY_REQUIRED", "server text")
    assertTrue(ErrorMessages.isPermanent(passkey))
    assertTrue(ErrorMessages.of(passkey).contains("Face ID"))
    assertTrue(ErrorMessages.isPermanent(ApiException(403, "ACCOUNT_INACTIVE", "x")))
  }
}
