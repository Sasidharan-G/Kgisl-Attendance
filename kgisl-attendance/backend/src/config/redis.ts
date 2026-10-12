import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => logger.info('[redis] connected'));
redis.on('error', (err) => logger.error('[redis] error', { error: err.message }));

const TAKE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
`;

/** Reads and deletes a key in one atomic step, so a single-use value can never be consumed twice. */
export async function takeValue(key: string): Promise<string | null> {
  return (await redis.eval(TAKE_SCRIPT, 1, key)) as string | null;
}

/** The QR token that is currently valid for a session (JSON: tokenHash, nonce, issuedAt, expiresAt). */
export const qrRedisKey = (sessionId: string) => `attendance:session:${sessionId}`;

/** The token that was replaced by the latest rotation; it stays usable for the short grace window. */
export const qrPreviousRedisKey = (sessionId: string) => `attendance:session:${sessionId}:previous`;

/** One scan claim per student per QR token: stops a double submit from being counted twice. */
export const scanLockKey = (sessionId: string, studentId: string) =>
  `attendance:lock:${sessionId}:${studentId}`;

/** Independent, ephemeral keys for the BLE beacon channel. Values never contain the raw token. */
export const beaconSessionKey = (sessionId: string) => `attendance:beacon:session:${sessionId}`;
export const beaconTokenKey = (tokenDigest: string) => `attendance:beacon:token:${tokenDigest}`;
export const beaconClaimKey = (sessionId: string, studentId: string) =>
  `attendance:beacon:claim:${sessionId}:${studentId}`;

/** Single-use WebAuthn challenges, one per student per ceremony. */
export const passkeyRegisterChallengeKey = (studentId: string) => `attendance:passkey:reg:${studentId}`;
export const passkeyAuthChallengeKey = (studentId: string) => `attendance:passkey:auth:${studentId}`;

/**
 * Refresh-token sessions live in Redis. Every refresh token has its own key (`rt:{jti}`) so one device can be
 * revoked alone, and belongs to a family set (`rtfam:{familyId}`) so that re-use of an already rotated token can
 * revoke the whole login.
 */
export const refreshTokenKey = (jti: string) => `attendance:rt:${jti}`;
export const refreshFamilyKey = (familyId: string) => `attendance:rtfam:${familyId}`;

/**
 * Short-lived copy of the pair issued when a refresh token was rotated. A second request that presents the same
 * (just rotated) token - another open tab, a retry after a slow response - gets this pair back instead of being
 * treated as token theft.
 */
export const refreshGraceKey = (jti: string) => `attendance:rtgrace:${jti}`;
