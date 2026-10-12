import QRCode from 'qrcode';
import { prisma } from '../config/prisma';
import { redis, qrRedisKey, qrPreviousRedisKey } from '../config/redis';
import { env } from '../config/env';
import {
  generateSecureToken,
  generateNonce,
  sha256Hex,
  signQrPayload,
  QrSignableFields,
} from '../utils/crypto';

interface QrPayload extends QrSignableFields {
  signature: string;
}

interface QrGenerationResult {
  payload: QrPayload;
  qrImageDataUrl: string;
}

const REFRESH_MS = env.QR_REFRESH_INTERVAL_SECONDS * 1000;
const GRACE_MS = env.QR_GRACE_SECONDS * 1000;

// The token that is being replaced is kept for the grace window so a student whose scan was decoded just before the
// rotation (slow GPS fix, slow network) is not rejected for something that was not their fault.
const ROTATE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then redis.call('SET', KEYS[2], current, 'PX', ARGV[2]) end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
return 1
`;

/**
 * Generates a completely new QR for a session: a fresh 256-bit token, nonce and timestamps every call, signed with
 * HMAC-SHA256. Only the SHA-256 hash of the token is stored in Postgres; the raw token exists in the signed QR and
 * in Redis (which expires it by itself).
 */
export async function generateNewQr(sessionId: string): Promise<QrGenerationResult> {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + REFRESH_MS;

  const token = generateSecureToken();
  const nonce = generateNonce();
  const signableFields: QrSignableFields = { sessionId, token, issuedAt, expiresAt, nonce };
  const signature = signQrPayload(signableFields);
  const tokenHash = sha256Hex(token);

  // Audit trail: the previous token is marked expired (not revoked: it is still inside its grace window).
  await prisma.attendanceQrHistory.updateMany({
    where: { sessionId, isExpired: false },
    data: { isExpired: true },
  });
  await prisma.attendanceQrHistory.create({
    data: { sessionId, tokenHash, nonce, generatedAt: new Date(issuedAt), expiresAt: new Date(expiresAt) },
  });

  await redis.eval(
    ROTATE_SCRIPT,
    2,
    qrRedisKey(sessionId),
    qrPreviousRedisKey(sessionId),
    JSON.stringify({ tokenHash, nonce, issuedAt, expiresAt }),
    GRACE_MS.toString(),
    (REFRESH_MS + GRACE_MS).toString()
  );

  const payload: QrPayload = { ...signableFields, signature };
  const qrImageDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 480,
  });
  return { payload, qrImageDataUrl };
}

/** Drops the live QR of a session immediately (pause, end, auto-end, cancel). */
export async function clearSessionQr(sessionId: string, options: { revokeHistory: boolean } = { revokeHistory: true }) {
  await redis.del(qrRedisKey(sessionId), qrPreviousRedisKey(sessionId));
  if (options.revokeHistory) {
    await prisma.attendanceQrHistory.updateMany({
      where: { sessionId, revoked: false },
      data: { isExpired: true, revoked: true },
    });
  }
}

/** Housekeeping: marks history rows whose time has passed as expired (Redis already enforces expiry on its own). */
export async function sweepExpiredQrHistory(): Promise<void> {
  await prisma.attendanceQrHistory.updateMany({
    where: { isExpired: false, expiresAt: { lt: new Date(Date.now() - GRACE_MS) } },
    data: { isExpired: true },
  });
}
