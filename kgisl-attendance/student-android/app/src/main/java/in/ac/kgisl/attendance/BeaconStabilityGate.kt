package edu.kgisl.attendance

class BeaconStabilityGate(
  private val requiredObservations: Int = 3,
  private val windowMs: Long = 2_500,
) {
  private data class Observation(val at: Long, val rssi: Int)
  private val observations = mutableMapOf<String, MutableList<Observation>>()

  @Synchronized
  fun observe(packet: String, rssi: Int, now: Long = System.currentTimeMillis()): Int? {
    observations.entries.removeIf { (_, values) -> values.none { now - it.at <= windowMs } }
    val values = observations.getOrPut(packet) { mutableListOf() }
    values.removeAll { now - it.at > windowMs }
    values += Observation(now, rssi)
    if (values.size < requiredObservations) return null
    observations.remove(packet)
    return values.map { it.rssi }.sorted()[values.size / 2]
  }
}
