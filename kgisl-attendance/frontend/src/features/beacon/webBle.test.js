import { describe, expect, it } from 'vitest';
import { createStabilityGate, isPacketFresh, packetFromManufacturerData, packetIssuedAtMillis } from './webBle.js';

function makeBytes(issuedAtSeconds) {
  const bytes = new Uint8Array(21);
  bytes[0] = 0x4b;
  bytes[1] = 1;
  new DataView(bytes.buffer).setUint32(4, issuedAtSeconds);
  for (let i = 8; i < 21; i += 1) bytes[i] = i * 3;
  return bytes;
}

describe('web BLE beacon packet', () => {
  it('encodes 21 bytes as a 28 char base64url packet and reads the timestamp back', () => {
    const packet = packetFromManufacturerData(new DataView(makeBytes(1_791_482_166).buffer));
    expect(packet).toHaveLength(28);
    expect(packet).toMatch(/^[A-Za-z0-9_-]{28}$/);
    expect(packetIssuedAtMillis(packet)).toBe(1_791_482_166_000);
  });

  it('round-trips the packet the helper sent to the real ESP32', () => {
    const sent = 'SwEAAGrH0daoqaqrrK2ur7CxsrO0';
    const bytes = Uint8Array.from(Buffer.from(sent, 'base64url'));
    expect(packetFromManufacturerData(bytes)).toBe(sent);
  });

  it('rejects data that is not a KGiSL beacon', () => {
    expect(packetFromManufacturerData(new Uint8Array(21))).toBeNull();
    expect(packetFromManufacturerData(new Uint8Array(5))).toBeNull();
    expect(packetFromManufacturerData(null)).toBeNull();
  });

  it('accepts only fresh packets', () => {
    const now = Date.now();
    const fresh = packetFromManufacturerData(makeBytes(Math.floor(now / 1000)));
    const stale = packetFromManufacturerData(makeBytes(Math.floor(now / 1000) - 60));
    expect(isPacketFresh(fresh, now)).toBe(true);
    expect(isPacketFresh(stale, now)).toBe(false);
  });
});

describe('stability gate', () => {
  it('needs three sightings of the same packet and returns the median RSSI', () => {
    const gate = createStabilityGate();
    expect(gate.observe('p', -60, 1000)).toBeNull();
    expect(gate.observe('p', -50, 1500)).toBeNull();
    expect(gate.observe('p', -70, 2000)).toBe(-60);
  });

  it('forgets sightings outside the window', () => {
    const gate = createStabilityGate();
    gate.observe('p', -60, 0);
    gate.observe('p', -60, 100);
    expect(gate.observe('p', -60, 10_000)).toBeNull();
  });
});
