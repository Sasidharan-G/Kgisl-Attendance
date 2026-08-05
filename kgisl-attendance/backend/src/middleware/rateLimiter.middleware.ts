import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { Errors } from '../utils/AppError';

/** Coarse IP-level guard against brute-force scan flooding. */
export const scanIpRateLimiter = rateLimit({
  windowMs: env.SCAN_RATE_LIMIT_WINDOW_MS,
  // Campus Wi-Fi commonly places an entire classroom behind one NAT address.
  // Per-student limiting below is the primary abuse control; this is only a
  // coarse unauthenticated flood ceiling and safely allows 60+ simultaneous scans.
  max: Math.max(1000, env.SCAN_RATE_LIMIT_MAX * 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests from this network, slow down.' },
});

/**
 * Brute-force protection on login/refresh endpoints. IP-scoped: a single actor
 * hammering credentials from one address gets slowed regardless of which
 * account they're guessing.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many authentication attempts, try again later.' },
});

/**
 * Fine-grained per-student rate limit using Redis, independent of IP —
 * prevents a single compromised account from hammering the validation
 * pipeline regardless of source IP/NAT.
 */
export async function scanStudentRateLimiter(req: Request, _res: Response, next: NextFunction) {
  const studentId = req.auth?.sub;
  if (!studentId) return next(Errors.INVALID_JWT());

  try {
    const key = `attendance:ratelimit:student:${studentId}`;
    const count = await redis.eval(
      `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      return current
      `,
      1,
      key,
      env.SCAN_RATE_LIMIT_WINDOW_MS.toString()
    );
    if (typeof count === 'number' && count > env.SCAN_RATE_LIMIT_MAX) {
      return next(Errors.RATE_LIMITED());
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
