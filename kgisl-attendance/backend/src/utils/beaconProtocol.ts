import crypto from 'crypto';
import { env } from '../config/env';
import {
  ACOUSTIC_TOKEN_ALPHABET,
  ACOUSTIC_TOKEN_LENGTH,
  normalizeAcousticToken,
} from './crypto';

// The payload is deliberately kept below the legacy BLE advertisement budget.
// It is transported as manufacturer/service data by the ESP32 and submitted
// unchanged by the student app. Only the backend owns the signing key.
export const BEACON_PACKET_MAGIC = 0x4b; // "K" for KGiSL
export const BEACON_PACKET_VERSION = 1;
export const BEACON_PACKET_LENGTH = 21;
export const BEACON_AUTH_TAG_LENGTH = 8;

const HEADER_LENGTH = BEACON_PACKET_LENGTH - BEACON_AUTH_TAG_LENGTH;
const TOKEN_BYTE_LENGTH = 5; // Eight Crockford Base32 symbols = exactly 40 bits.
const SIGNING_DOMAIN = Buffer.from('kgisl-ble-beacon-v1\0', 'utf8');

export type BeaconPacketFields = {
  beaconId: number;
  issuedAt: number;
  token: string;
};

export class BeaconPacketError extends Error {
  constructor(public readonly code: 'MALFORMED' | 'AUTH_FAILED' | 'EXPIRED') {
    super(`BLE beacon packet ${code.toLowerCase().replace('_', ' ')}`);
  }
}

function assertBeaconId(beaconId: number): void {
  if (!Number.isInteger(beaconId) || beaconId < 1 || beaconId > 0xffff) {
    throw new RangeError('beaconId must be an integer between 1 and 65535');
  }
}

function packToken(token: string): Buffer {
  const normalized = normalizeAcousticToken(token);
  if (normalized.length !== ACOUSTIC_TOKEN_LENGTH) {
    throw new TypeError(`token must contain exactly ${ACOUSTIC_TOKEN_LENGTH} Crockford Base32 symbols`);
  }

  let bits = 0n;
  for (const symbol of normalized) {
    const value = ACOUSTIC_TOKEN_ALPHABET.indexOf(symbol);
    if (value < 0) throw new TypeError('token contains an invalid Crockford Base32 symbol');
    bits = (bits << 5n) | BigInt(value);
  }

  const packed = Buffer.alloc(TOKEN_BYTE_LENGTH);
  for (let index = TOKEN_BYTE_LENGTH - 1; index >= 0; index -= 1) {
    packed[index] = Number(bits & 0xffn);
    bits >>= 8n;
  }
  return packed;
}

function unpackToken(packed: Buffer): string {
  let bits = 0n;
  for (const byte of packed) bits = (bits << 8n) | BigInt(byte);

  const symbols = Array<string>(ACOUSTIC_TOKEN_LENGTH);
  for (let index = ACOUSTIC_TOKEN_LENGTH - 1; index >= 0; index -= 1) {
    symbols[index] = ACOUSTIC_TOKEN_ALPHABET[Number(bits & 31n)];
    bits >>= 5n;
  }
  return symbols.join('');
}

function authTag(header: Buffer): Buffer {
  return crypto
    .createHmac('sha256', Buffer.from(env.BEACON_HMAC_SECRET, 'hex'))
    .update(SIGNING_DOMAIN)
    .update(header)
    .digest()
    .subarray(0, BEACON_AUTH_TAG_LENGTH);
}

/** Encodes a backend-authenticated packet as 28-character base64url text. */
export function encodeBeaconPacket(fields: BeaconPacketFields): string {
  assertBeaconId(fields.beaconId);
  const issuedAtSeconds = Math.floor(fields.issuedAt / 1000);
  if (!Number.isSafeInteger(fields.issuedAt) || issuedAtSeconds < 1 || issuedAtSeconds > 0xffffffff) {
    throw new RangeError('issuedAt must be a positive epoch-millisecond timestamp');
  }

  const header = Buffer.alloc(HEADER_LENGTH);
  header[0] = BEACON_PACKET_MAGIC;
  header[1] = BEACON_PACKET_VERSION;
  header.writeUInt16BE(fields.beaconId, 2);
  header.writeUInt32BE(issuedAtSeconds, 4);
  packToken(fields.token).copy(header, 8);

  return Buffer.concat([header, authTag(header)]).toString('base64url');
}

/**
 * Authenticates and decodes a packet. Freshness is checked here and the Redis
 * token lookup remains the second, authoritative expiry/revocation check.
 */
export function verifyBeaconPacket(
  encoded: string,
  now = Date.now()
): BeaconPacketFields {
  let packet: Buffer;
  try {
    if (!/^[A-Za-z0-9_-]{28}$/.test(encoded)) throw new Error('invalid encoding');
    packet = Buffer.from(encoded, 'base64url');
  } catch {
    throw new BeaconPacketError('MALFORMED');
  }

  if (
    packet.length !== BEACON_PACKET_LENGTH ||
    packet[0] !== BEACON_PACKET_MAGIC ||
    packet[1] !== BEACON_PACKET_VERSION
  ) {
    throw new BeaconPacketError('MALFORMED');
  }

  const header = packet.subarray(0, HEADER_LENGTH);
  const receivedTag = packet.subarray(HEADER_LENGTH);
  if (!crypto.timingSafeEqual(receivedTag, authTag(header))) {
    throw new BeaconPacketError('AUTH_FAILED');
  }

  const issuedAt = packet.readUInt32BE(4) * 1000;
  const ageMs = now - issuedAt;
  const futureToleranceMs = env.BEACON_CLOCK_SKEW_SECONDS * 1000;
  const maximumAgeMs = env.BEACON_PACKET_TTL_SECONDS * 1000;
  if (ageMs < -futureToleranceMs || ageMs > maximumAgeMs) {
    throw new BeaconPacketError('EXPIRED');
  }

  return {
    beaconId: packet.readUInt16BE(2),
    issuedAt,
    token: unpackToken(packet.subarray(8, 8 + TOKEN_BYTE_LENGTH)),
  };
}
