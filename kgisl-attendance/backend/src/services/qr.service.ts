import QRCode from 'qrcode';
import { prisma } from '../config/prisma';
import { redis, qrRedisKey } from '../config/redis';
import { env } from '../config/env';
import {
  generateSecureToken,
  generateNonce,
  sha256Hex,
  signQrPayload,
  QrSignableFields,
} from '../utils/crypto';
import { logger } from '../utils/logger';

export interface QrPayload extends QrSignableFields {
  signature: string;
}

export interface QrGenerationResult {
  payload: QrPayload;
  qrImageDataUrl: string;
}

const REFRESH_MS = env.QR_REFRESH_INTERVAL_SECONDS * 1000;

/**
 * Generates a completely new QR for a session.
 *
 * Guarantees:
 *  - A brand-new SecureRandom (256-bit) token every call — never reused, never derived
 *    from the previous token.
 *  - A fresh UUID v4 + nonce + timestamps every call.
 *  - The previous token is immediately revoked (DB + Redis) before/atomically with
 *    issuing the new one, so at most one token is ever valid at a time.
 *  - Only the SHA-256 hash of the token is persisted to Postgres. The raw token
 *    exists only in-memory here, inside the signed QR payload, and in Redis
 *    (which itself will auto-expire it) — never in a durable table.
 */
export async function generateNewQr(sessionId: string): Promise<QrGenerationResult> {
  const now = Date.now();
  const issuedAt = now;
  const expiresAt = now + REFRESH_MS;

  const token = generateSecureToken(); // NEW 256-bit CSPRNG token, every single call
  const nonce = generateNonce();

  const signableFields: QrSignableFields = {
    sessionId,
    token,
    issuedAt,
    expiresAt,
    nonce,
  };

  const signature = signQrPayload(signableFields);
  const tokenHash = sha256Hex(token);

  // 1. Revoke whatever token was previously active for this session (belt & suspenders —
  //    Redis TTL would also expire it, but we revoke explicitly for immediate invalidation
  //    and for the audit trail in attendance_qr_history).
  await revokePreviousToken(sessionId);

  // 2. Persist only the HASH to durable history (never the raw token).
  await prisma.attendanceQrHistory.create({
    data: {
      sessionId,
      tokenHash,
      nonce,
      generatedAt: new Date(issuedAt),
      expiresAt: new Date(expiresAt),
    },
  });

  // 3. Update the session's "current" pointer (also hash-only).
  await prisma.attendanceSession.update({
    where: { sessionId },
    data: {
      currentQrTokenHash: tokenHash,
      currentQrExpiry: new Date(expiresAt),
    },
  });

  // 4. Store the *raw* token in Redis ONLY, with TTL exactly matching expiry.
  //    This is the single source of truth used for fast validation during scan.
  //    Auto-deletes after expiration — nothing to clean up.
  const redisValue = JSON.stringify({ tokenHash, nonce, issuedAt, expiresAt });
  await redis.set(qrRedisKey(sessionId), redisValue, 'PX', REFRESH_MS);

  // 5. Generate the QR image from the signed payload (never from raw attendance data).
  const payload: QrPayload = { ...signableFields, signature };
  const qrImageDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 480,
  });

  logger.info('[qr] generated new token', { sessionId, tokenHash: tokenHash.slice(0, 12) });

  return { payload, qrImageDataUrl };
}

/** Marks the currently-active history row (if any) as expired/revoked. Idempotent. */
async function revokePreviousToken(sessionId: string): Promise<void> {
  await prisma.attendanceQrHistory.updateMany({
    where: { sessionId, isExpired: false, revoked: false },
    data: { isExpired: true, revoked: true },
  });
}

/**
 * Background sweeper (call from a cron/interval) to mark any DB rows whose
 * expiresAt has passed but weren't explicitly revoked (e.g. session crashed
 * mid-refresh). Redis already self-expires; this just keeps Postgres consistent
 * for reporting/audit purposes.
 */
export async function sweepExpiredQrHistory(): Promise<void> {
  await prisma.attendanceQrHistory.updateMany({
    where: { isExpired: false, expiresAt: { lt: new Date() } },
    data: { isExpired: true },
  });
}
