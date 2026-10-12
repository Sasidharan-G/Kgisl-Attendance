import crypto from 'crypto';
import { redis, refreshTokenKey, refreshFamilyKey, refreshGraceKey, takeValue } from '../config/redis';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken, RefreshPayload, type Role } from '../middleware/auth.middleware';
import { writeAuditLog } from './audit.service';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';

interface RedisRtRecord {
  sub: string;
  role: Role;
  familyId: string;
  /** Account must change its initial password; carried across refreshes. */
  mcp?: boolean;
}

const TTL_SECONDS = env.JWT_REFRESH_TTL_SECONDS;
/** How long a just-rotated refresh token keeps returning the pair it produced (see refreshGraceKey). */
const REFRESH_REUSE_GRACE_SECONDS = 20;

interface AccountState {
  /** False once an administrator deactivated the account (or the student's batch was archived). */
  active: boolean;
  mustChangePassword: boolean;
}

async function accountState(sub: string, role: Role): Promise<AccountState | null> {
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

/**
 * Issues a brand-new access + refresh token pair for a fresh login (new family). Password logins are gated while the
 * account still uses an initial password; Google sign-in has no password to change.
 */
export async function issueTokenPair(sub: string, role: Role, options: { passwordGate?: boolean } = {}) {
  const mcp = options.passwordGate === false ? false : Boolean((await accountState(sub, role))?.mustChangePassword);
  return mintPair(sub, role, crypto.randomUUID(), mcp);
}

async function mintPair(sub: string, role: Role, familyId: string, mcp = false) {
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
 * Rotates a refresh token: the presented token is consumed exactly once (atomically) and a new one is issued in its
 * place. If the presented jti is already gone it has either expired or was rotated before and is being replayed (for
 * example a stolen token used after the real client rotated it). That is treated as a compromise and the whole token
 * family is revoked.
 */
export async function rotateRefreshToken(token: string, ctx: { ip: string | null; userAgent: string | null }) {
  let decoded: RefreshPayload;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw Errors.INVALID_JWT();
  }

  const { jti, familyId, sub, role } = decoded;
  const raw = await takeValue(refreshTokenKey(jti));

  if (!raw) {
    // The same token presented twice within seconds is almost always a second browser tab (or a retry),
    // not theft: hand back the pair the first request produced instead of revoking the whole login.
    const graced = await redis.get(refreshGraceKey(jti));
    if (graced) {
      try { return JSON.parse(graced) as Awaited<ReturnType<typeof mintPair>>; } catch { /* fall through to reuse detection */ }
    }
    if (await redis.exists(refreshFamilyKey(familyId))) {
      await revokeFamily(familyId);
      logger.warn('[auth] refresh token reuse detected: family revoked', { sub, familyId });
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
  await redis.srem(refreshFamilyKey(familyId), jti);

  // A deactivated (or archived) account must not keep a login alive just because its refresh token is still valid.
  const state = await accountState(sub, role);
  if (!state || !state.active) {
    await revokeFamily(familyId);
    throw Errors.INVALID_JWT();
  }

  let carriedGate = false;
  try { carriedGate = Boolean((JSON.parse(raw) as RedisRtRecord).mcp); } catch { /* malformed record: treat as ungated */ }
  const pair = await mintPair(sub, role, familyId, carriedGate);
  await redis.set(refreshGraceKey(jti), JSON.stringify(pair), 'EX', REFRESH_REUSE_GRACE_SECONDS);
  return pair;
}

/** Revokes exactly one device/session's refresh token (explicit logout). */
export async function revokeRefreshToken(token: string) {
  try {
    const decoded = verifyRefreshToken(token);
    await redis.del(refreshTokenKey(decoded.jti));
    await redis.srem(refreshFamilyKey(decoded.familyId), decoded.jti);
  } catch {
    // Already invalid or expired: logout is idempotent, nothing further to do.
  }
}

async function revokeFamily(familyId: string) {
  const members = await redis.smembers(refreshFamilyKey(familyId));
  if (members.length) await redis.del(...members.map(refreshTokenKey));
  await redis.del(refreshFamilyKey(familyId));
}

/**
 * Signs an account out everywhere (password change/reset, deactivation). Scans the refresh records and revokes
 * every login family that belongs to the account.
 */
export async function revokeAllUserSessions(sub: string, role: Role) {
  const families = new Set<string>();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'attendance:rt:*', 'COUNT', 200);
    cursor = next;
    if (keys.length) {
      const values = await redis.mget(keys);
      values.forEach((raw) => {
        if (!raw) return;
        try {
          const record = JSON.parse(raw) as RedisRtRecord;
          if (record.sub === sub && record.role === role) families.add(record.familyId);
        } catch { /* ignore malformed or expired entries */ }
      });
    }
  } while (cursor !== '0');
  await Promise.all([...families].map(revokeFamily));
}
