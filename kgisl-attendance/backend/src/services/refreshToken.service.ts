import crypto from 'crypto';
import { redis, refreshTokenKey, refreshFamilyKey, refreshGraceKey } from '../config/redis';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken, RefreshPayload } from '../middleware/auth.middleware';
import { writeAuditLog } from './audit.service';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';

interface RedisRtRecord {
  sub: string;
  role: 'ADMIN' | 'FACULTY' | 'STUDENT';
  familyId: string;
  /** Account must change its initial password; carried across refreshes. */
  mcp?: boolean;
}

const TTL_SECONDS = env.JWT_REFRESH_TTL_SECONDS;
/** How long a just-rotated refresh token keeps returning the pair it produced (see refreshGraceKey). */
export const REFRESH_REUSE_GRACE_SECONDS = 20;

interface AccountState {
  /** False once an administrator deactivated the account (or the student's batch was archived). */
  active: boolean;
  mustChangePassword: boolean;
}

async function accountState(sub: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT'): Promise<AccountState | null> {
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { id: sub }, select: { isActive: true, archivedAt: true, mustChangePassword: true } });
    return student ? { active: student.isActive && student.archivedAt === null, mustChangePassword: student.mustChangePassword } : null;
  }
  const select = { isActive: true, mustChangePassword: true } as const;
  const account = role === 'ADMIN'
    ? await prisma.admin.findUnique({ where: { id: sub }, select })
    : await prisma.faculty.findUnique({ where: { id: sub }, select });
  return account ? { active: account.isActive, mustChangePassword: account.mustChangePassword } : null;
}

async function mustChangePassword(sub: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT'): Promise<boolean> {
  return Boolean((await accountState(sub, role))?.mustChangePassword);
}

/**
 * Issues a brand-new access + refresh token pair for a fresh login (new family). Password logins are
 * gated while the account still uses an initial password; Google sign-in has no password to change.
 */
export async function issueTokenPair(sub: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT', options: { passwordGate?: boolean } = {}) {
  const familyId = crypto.randomUUID();
  const mcp = options.passwordGate === false ? false : await mustChangePassword(sub, role);
  return mintPair(sub, role, familyId, mcp);
}

async function mintPair(sub: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT', familyId: string, mcp = false) {
  const jti = crypto.randomUUID();

  const record: RedisRtRecord = { sub, role, familyId, ...(mcp ? { mcp: true } : {}) };
  await redis.set(refreshTokenKey(jti), JSON.stringify(record), 'EX', TTL_SECONDS);
  await redis.sadd(refreshFamilyKey(familyId), jti);
  await redis.expire(refreshFamilyKey(familyId), TTL_SECONDS);

  const accessToken = signAccessToken({ sub, role, ...(mcp ? { mcp: true } : {}) });
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
    // The same token presented twice within seconds is almost always a second browser tab (or a retry),
    // not theft: hand back the pair the first request produced instead of revoking the whole login.
    const graced = await redis.get(refreshGraceKey(jti));
    if (graced) {
      try { return JSON.parse(graced) as Awaited<ReturnType<typeof mintPair>>; } catch { /* fall through to reuse detection */ }
    }
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

  // A deactivated (or archived) account must not keep a login alive just because its refresh token is
  // still inside its 7-day lifetime.
  const state = await accountState(sub, role);
  if (!state || !state.active) {
    await revokeFamily(familyId);
    throw Errors.INVALID_JWT();
  }

  // Consume this token (single use) before minting the next one.
  await redis.del(refreshTokenKey(jti));
  await redis.srem(refreshFamilyKey(familyId), jti);

  let carriedGate = false;
  try { carriedGate = Boolean((JSON.parse(raw) as RedisRtRecord).mcp); } catch { /* malformed record: treat as ungated */ }
  const pair = await mintPair(sub, role, familyId, carriedGate);
  await redis.set(refreshGraceKey(jti), JSON.stringify(pair), 'EX', REFRESH_REUSE_GRACE_SECONDS);

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
