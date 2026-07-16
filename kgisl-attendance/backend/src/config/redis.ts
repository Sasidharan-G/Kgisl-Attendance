import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => logger.info('[redis] connected'));
redis.on('error', (err) => logger.error('[redis] error', { error: err.message }));

/**
 * Key convention (as specified): attendance:session:{sessionId}
 * Value: JSON string of the currently active QR payload (without signature secret).
 * TTL: exactly the QR refresh interval — Redis auto-expires the token.
 */
export const qrRedisKey = (sessionId: string) => `attendance:session:${sessionId}`;

/** Tracks per-student-per-session scan attempts for rate limiting / duplicate short-circuit. */
export const scanLockKey = (sessionId: string, studentId: string) =>
  `attendance:lock:${sessionId}:${studentId}`;

/** Independent, ephemeral keys for the acoustic channel. Values never contain the raw token. */
export const acousticSessionKey = (sessionId: string) =>
  `attendance:acoustic:session:${sessionId}`;
export const acousticTokenKey = (tokenDigest: string) =>
  `attendance:acoustic:token:${tokenDigest}`;
export const acousticClaimKey = (sessionId: string, studentId: string) =>
  `attendance:acoustic:claim:${sessionId}:${studentId}`;

/**
 * Refresh-token session storage (as required: Redis-backed sessions, not a DB table
 * on the hot path). Each individual refresh token gets its own key (`rt:{jti}`) so a
 * single device/session can be revoked without touching its siblings, and every token
 * also belongs to a "family" set (`rtfam:{familyId}`) — all tokens descended from one
 * login — so that reuse of an already-rotated token can revoke the *entire* family
 * (a strong signal of token theft).
 */
export const refreshTokenKey = (jti: string) => `attendance:rt:${jti}`;
export const refreshFamilyKey = (familyId: string) => `attendance:rtfam:${familyId}`;
