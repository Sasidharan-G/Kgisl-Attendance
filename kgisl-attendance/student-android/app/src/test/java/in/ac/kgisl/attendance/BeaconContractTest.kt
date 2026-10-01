package edu.kgisl.attendance

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BeaconContractTest {
  @Test fun packetConstantsMatchBackendContract() {
    assertEquals(21, BeaconPacket.BINARY_LENGTH)
    assertEquals(28, BeaconPacket.TEXT_LENGTH)
    assertTrue("SwEAAAAAAAAAAAAAAAAAAAAAAAAA".length == 28)
    assertFalse(BeaconPacket.isValidText("bad"))
  }

  @Test fun stabilityGateRequiresThreeRecentMatchingPacketsAndReturnsMedianRssi() {
    val gate = BeaconStabilityGate()
    assertEquals(null, gate.observe("packet", -80, 1_000))
    assertEquals(null, gate.observe("packet", -60, 1_500))
    assertEquals(-70, gate.observe("packet", -70, 2_000))
  }

  @Test fun stabilityGateDropsOldObservations() {
    val gate = BeaconStabilityGate()
    assertEquals(null, gate.observe("packet", -70, 1_000))
    assertEquals(null, gate.observe("packet", -70, 4_000))
  }
}
