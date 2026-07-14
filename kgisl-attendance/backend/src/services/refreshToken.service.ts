import crypto from 'crypto';
import { redis, refreshTokenKey, refreshFamilyKey } from '../config/redis';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken, RefreshPayload } from '../middleware/auth.middleware';
import { writeAuditLog } from './audit.service';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';

interface RedisRtRecord {
  sub: string;
  role: 'ADMIN' | 'FACULTY' | 'STUDENT';
  familyId: string;
}

const TTL_SECONDS = env.JWT_REFRESH_TTL_SECONDS;

/** Issues a brand-new access + refresh token pair for a fresh login (new family). */
export async function issueTokenPair(sub: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT') {
  const familyId = crypto.randomUUID();
  return mintPair(sub, role, familyId);
}

async function mintPair(sub: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT', familyId: string) {
  const jti = crypto.randomUUID();

  const record: RedisRtRecord = { sub, role, familyId };
  await redis.set(refreshTokenKey(jti), JSON.stringify(record), 'EX', TTL_SECONDS);
  await redis.sadd(refreshFamilyKey(familyId), jti);
  await redis.expire(refreshFamilyKey(familyId), TTL_SECONDS);

  const accessToken = signAccessToken({ sub, role });
  const refreshToken = signRefreshToken({ sub, role, jti, familyId });

  return { accessToken, refreshToken, expiresIn: TTL_SECONDS };
}

/**
 * Rotates a refresh token: the presented token is consumed exactly once and a new
 * one is issued in its place. If the presented jti is no longer in Redis, it has
 * either expired naturally OR — more importantly — it was already rotated once
 * before and is now being replayed (e.g. a stolen token used after the legitimate
 * client already rotated it). In that case we treat it as a compromise signal and
 * revoke the entire token family, forcing re-login on every device.
 */
export async function rotateRefreshToken(token: string, ctx: { ip: string | null; userAgent: string | null }) {
  let decoded: RefreshPayload;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw Errors.INVALID_JWT();
  }

  const { jti, familyId, sub, role } = decoded;
  const raw = await redis.get(refreshTokenKey(jti));

  if (!raw) {
    // Possible replay of an already-rotated (or expired) token.
    const familyStillExists = await redis.exists(refreshFamilyKey(familyId));
    if (familyStillExists) {
      await revokeFamily(familyId);
      logger.warn('[auth] refresh token reuse detected — family revoked', { sub, familyId });
      await writeAuditLog({
        actorId: sub,
        actorType: role,
        action: 'REFRESH_REUSE_DETECTED',
        success: false,
        reasonCode: 'TOKEN_REUSE',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { familyId },
      });
    }
    throw Errors.INVALID_JWT();
  }

  // Consume this token (single use) before minting the next one.
  await redis.del(refreshTokenKey(jti));
  await redis.srem(refreshFamilyKey(familyId), jti);

  const pair = await mintPair(sub, role, familyId);

  await writeAuditLog({
    actorId: sub,
    actorType: role,
    action: 'TOKEN_REFRESHED',
    success: true,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return pair;
}

/** Revokes exactly one device/session's refresh token (used on explicit logout). */
export async function revokeRefreshToken(token: string) {
  try {
    const decoded = verifyRefreshToken(token);
    await redis.del(refreshTokenKey(decoded.jti));
    await redis.srem(refreshFamilyKey(decoded.familyId), decoded.jti);
  } catch {
    // Already invalid/expired — logout is idempotent, nothing further to do.
  }
}

/** Revokes every device/session descended from one login (used on reuse-detection or "log out everywhere"). */
export async function revokeFamily(familyId: string) {
  const members = await redis.smembers(refreshFamilyKey(familyId));
  if (members.length) {
    await redis.del(...members.map(refreshTokenKey));
  }
  await redis.del(refreshFamilyKey(familyId));
}

/** Rare security operation used after a password reset/change. Scans refresh
 * records and revokes every device family belonging to the account. */
export async function revokeAllUserSessions(sub: string, role: RedisRtRecord['role']) {
  const families = new Set<string>();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'attendance:rt:*', 'COUNT', 200);
    cursor = next;
    if (keys.length) {
      const values = await redis.mget(keys);
      values.forEach((raw) => {
        if (!raw) return;
        try { const record = JSON.parse(raw) as RedisRtRecord; if (record.sub === sub && record.role === role) families.add(record.familyId); } catch { /* ignore malformed/expired entries */ }
      });
    }
  } while (cursor !== '0');
  await Promise.all([...families].map(revokeFamily));
}
