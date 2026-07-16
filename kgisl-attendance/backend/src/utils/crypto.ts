import crypto from 'crypto';
import { env } from '../config/env';

/**
 * SECURITY NOTE
 * -------------
 * We exclusively use Node's `crypto` module, which is backed by OpenSSL's
 * CSPRNG (equivalent guarantee to Java's java.security.SecureRandom).
 * `Math.random()` / any non-cryptographic PRNG is NEVER used anywhere
 * in this module.
 */

/** Generates a 256-bit (32 byte) cryptographically secure random token, base64url encoded. */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url'); // 256-bit entropy
}

/** Generates a RFC-4122 v4 UUID using a CSPRNG (crypto.randomUUID uses OS CSPRNG). */
export function generateUuidV4(): string {
  return crypto.randomUUID();
}

/** Generates a unique nonce (128-bit) — distinct from the token, used to prevent replay even if a token were ever reused. */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex'); // 128-bit
}

/** One-way SHA-256 hash — used to persist tokens at rest. Raw tokens are NEVER stored. */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// Crockford Base32 deliberately omits I, L, O and U, which reduces decoding
// ambiguity when a noisy acoustic receiver reconstructs a short token.
export const ACOUSTIC_TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ACOUSTIC_TOKEN_LENGTH = 8;

/** Generates an 8-character, 40-bit Crockford Base32 acoustic token. */
export function generateAcousticToken(): string {
  const bytes = crypto.randomBytes(ACOUSTIC_TOKEN_LENGTH);
  let token = '';
  for (const byte of bytes) token += ACOUSTIC_TOKEN_ALPHABET[byte & 31];
  return token;
}

/** Canonical form accepted from the decoder; malformed symbols are rejected by the route schema. */
export function normalizeAcousticToken(token: string): string {
  return token.trim().toUpperCase();
}

/**
 * Keyed digest used for Redis lookup. The raw short token is returned to the
 * faculty once, but is never durably persisted or written to logs.
 */
export function acousticTokenDigest(token: string): string {
  return crypto
    .createHmac('sha256', Buffer.from(env.ACOUSTIC_TOKEN_PEPPER, 'utf8'))
    .update(`kgisl-acoustic-v1\0${normalizeAcousticToken(token)}`, 'utf8')
    .digest('hex');
}

/**
 * Canonical, order-stable serialization of the QR payload fields that get signed.
 * Signing a canonical string (rather than JSON.stringify on an object) avoids
 * signature mismatches from key-ordering differences across systems.
 */
export interface QrSignableFields {
  sessionId: string;
  token: string;
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  nonce: string;
}

function canonicalize(fields: QrSignableFields): string {
  return [fields.sessionId, fields.token, fields.issuedAt, fields.expiresAt, fields.nonce].join(
    '.'
  );
}

/** HMAC-SHA256 sign the QR payload using the server-side secret key (never sent to client). */
export function signQrPayload(fields: QrSignableFields): string {
  return crypto
    .createHmac('sha256', Buffer.from(env.QR_HMAC_SECRET, 'hex'))
    .update(canonicalize(fields))
    .digest('base64url');
}

/**
 * Verifies a QR signature using constant-time comparison to prevent timing attacks.
 * Returns false on ANY malformed input rather than throwing, so callers can treat
 * it as a plain boolean validation gate.
 */
export function verifyQrSignature(fields: QrSignableFields, signature: string): boolean {
  try {
    const expected = signQrPayload(fields);
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}
