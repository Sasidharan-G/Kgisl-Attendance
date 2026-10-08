/**
 * Browser-side BLE beacon scanner (Web Bluetooth). Port of the Android BleBeaconScanner,
 * BeaconPacket and BeaconStabilityGate so students can mark BLE attendance from Chrome.
 *
 * Requires HTTPS (or localhost), Chrome/Edge on Android or desktop, Bluetooth + Location ON.
 */
export const BEACON_COMPANY_ID = 0xffff; // prototype manufacturer id, matches the ESP32 firmware
export const PACKET_BYTES = 21;
export const PACKET_TEXT_LENGTH = 28;
const NAME_PREFIX = 'KGISL';

/**
 * Why Alpha BLE can or cannot run in this browser. `no-watch` means Chrome exposes Web Bluetooth but
 * not advertisement watching (still behind a flag in some Chrome builds).
 */
export function bleSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { ok: false, reason: 'no-bluetooth' };
  if (!window.isSecureContext) return { ok: false, reason: 'insecure' };
  if (!navigator.bluetooth) return { ok: false, reason: 'no-bluetooth' };
  if (typeof BluetoothDevice === 'undefined' || !('watchAdvertisements' in BluetoothDevice.prototype)) return { ok: false, reason: 'no-watch' };
  return { ok: true, reason: 'ok' };
}

export function webBluetoothSupported() {
  return bleSupport().ok;
}

export const BLE_UNSUPPORTED_MESSAGES = {
  insecure: 'Bluetooth needs a secure (HTTPS) page. Open the official attendance link.',
  'no-bluetooth': 'This browser has no Web Bluetooth. Use Chrome on Android, or Beta · QR.',
  'no-watch': 'Your Chrome has Web Bluetooth but beacon scanning is switched off. Turn it on once (steps below), or use Beta · QR.',
};

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** DataView/Uint8Array of manufacturer data -> 28 char base64url packet, or null if not ours. */
export function packetFromManufacturerData(data) {
  if (!data) return null;
  const bytes = data instanceof Uint8Array
    ? data
    : new Uint8Array(data.buffer, data.byteOffset ?? 0, data.byteLength);
  if (bytes.length !== PACKET_BYTES || bytes[0] !== 0x4b || bytes[1] !== 1) return null;
  const text = toBase64Url(bytes);
  return text.length === PACKET_TEXT_LENGTH ? text : null;
}

/** Seconds-since-epoch embedded in bytes 4..7 -> epoch milliseconds. */
export function packetIssuedAtMillis(packet) {
  if (typeof packet !== 'string' || !/^[A-Za-z0-9_-]{28}$/.test(packet)) return null;
  const base64 = packet.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  if (binary.length !== PACKET_BYTES) return null;
  const seconds = ((binary.charCodeAt(4) << 24) | (binary.charCodeAt(5) << 16) | (binary.charCodeAt(6) << 8) | binary.charCodeAt(7)) >>> 0;
  return seconds * 1000;
}

/** A packet is usable only while it is fresh (the server enforces the same window). */
export function isPacketFresh(packet, now = Date.now()) {
  const issuedAt = packetIssuedAtMillis(packet);
  return issuedAt !== null && now - issuedAt >= -3_000 && now - issuedAt <= 30_000;
}

/** Same packet seen `required` times inside `windowMs` -> returns the median RSSI, else null. */
export function createStabilityGate({ required = 3, windowMs = 2_500 } = {}) {
  const seen = new Map();
  return {
    observe(packet, rssi, now = Date.now()) {
      for (const [key, values] of seen) {
        if (!values.some((value) => now - value.at <= windowMs)) seen.delete(key);
      }
      const values = (seen.get(packet) ?? []).filter((value) => now - value.at <= windowMs);
      values.push({ at: now, rssi });
      seen.set(packet, values);
      if (values.length < required) return null;
      seen.delete(packet);
      const sorted = values.map((value) => value.rssi).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    },
  };
}

/** Turns a Web Bluetooth failure into a code + student-facing message. */
export function explainBleError(error) {
  const name = error?.name;
  const text = String(error?.message ?? '');
  if (error?.code === 'BLE_UNSUPPORTED') return error;
  if (name === 'NotFoundError' && /cancel/i.test(text)) {
    return { code: 'BLE_CANCELLED', message: 'Bluetooth device was not selected. Tap Start and choose KGISL-BEACON.' };
  }
  if (name === 'NotFoundError') {
    return { code: 'BLE_NO_DEVICE', message: 'No classroom beacon found nearby. Turn on Bluetooth and Location, and stay inside the class.' };
  }
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return { code: 'BLE_DENIED', message: 'Bluetooth permission was blocked. Allow Bluetooth and Location for this site, then try again.' };
  }
  if (name === 'NotSupportedError') {
    return { code: 'BLE_UNSUPPORTED', message: 'Bluetooth is not available on this device. Turn Bluetooth on or use Beta · QR.' };
  }
  return { code: error?.code || 'BLE_ERROR', message: text || 'Bluetooth scan failed. Turn Bluetooth off and on, then retry.' };
}

/**
 * Must run directly from a tap (user gesture). Reuses an already-permitted beacon when the browser
 * remembers one, otherwise shows the browser's Bluetooth chooser filtered to KGISL beacons.
 */
export async function selectBeaconDevice() {
  const support = bleSupport();
  if (!support.ok) throw { code: 'BLE_UNSUPPORTED', message: BLE_UNSUPPORTED_MESSAGES[support.reason] };
  try {
    if (typeof navigator.bluetooth.getDevices === 'function') {
      const known = await navigator.bluetooth.getDevices();
      const remembered = known.find((device) => device.name?.startsWith(NAME_PREFIX) && typeof device.watchAdvertisements === 'function');
      if (remembered) return remembered;
    }
  } catch { /* fall through to the chooser */ }
  try {
    return await navigator.bluetooth.requestDevice({
      filters: [{ manufacturerData: [{ companyIdentifier: BEACON_COMPANY_ID, dataPrefix: new Uint8Array([0x4b, 1]) }] }],
    });
  } catch (error) {
    throw explainBleError(error);
  }
}

/**
 * Listens to the beacon's advertisements. `onStable({ packet, rssi })` fires once a packet has been
 * seen three times in a short window (filters out one-off noise). Call `stop()` to end the scan.
 */
export async function watchBeacon(device, { onStable } = {}) {
  const gate = createStabilityGate();
  const controller = new AbortController();
  const listener = (event) => {
    const packet = packetFromManufacturerData(event.manufacturerData?.get(BEACON_COMPANY_ID));
    if (!packet || typeof event.rssi !== 'number') return;
    const rssi = gate.observe(packet, event.rssi);
    if (rssi !== null) onStable?.({ packet, rssi });
  };
  device.addEventListener('advertisementreceived', listener);
  const stop = () => {
    device.removeEventListener('advertisementreceived', listener);
    controller.abort();
  };
  try {
    await device.watchAdvertisements({ signal: controller.signal });
  } catch (error) {
    stop();
    throw explainBleError(error);
  }
  return { stop };
}
