import rateLimit from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env';

/**
 * Authentication rate limits.
 *
 * Campus Wi-Fi puts a whole classroom (and often the whole college) behind ONE public IP. The previous
 * limiter allowed 10 requests per IP per 15 minutes for login, refresh and password reset combined, so
 * the 11th student to sign in at the start of a class was locked out. The limits below are keyed by the
 * *account being attacked* instead, count only failed attempts where that is what matters, and keep a
 * much larger per-IP ceiling purely as a flood guard.
 */
const WINDOW_MS = env.AUTH_RATE_LIMIT_WINDOW_MS;
const message = { code: 'RATE_LIMITED', message: 'Too many authentication attempts, try again later.' };

/** Normalised e-mail from the request body, if present. */
export function emailFromBody(req: Request): string | null {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.length > 0 && email.length <= 254 ? email.trim().toLowerCase() : null;
}

/** Key identifying the account a request is aimed at (falls back to the signed-in user, then the IP). */
export function accountKey(req: Request): string {
  const target = emailFromBody(req) ?? req.auth?.sub ?? req.ip ?? 'unknown';
  return `${req.path}|${target}`;
}

function chain(first: RequestHandler, second: RequestHandler): RequestHandler {
  return (req, res, next) => first(req, res, (error?: unknown) => (error ? next(error) : second(req, res, next)));
}

/** Flood ceiling per IP. Only failed attempts count, so a class of students signing in successfully never trips it. */
const ipFailureLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: env.AUTH_IP_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

/** Brute-force guard per account: N wrong passwords / codes in a window locks that account's endpoint, nobody else's. */
const accountFailureLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  keyGenerator: accountKey,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

/** Login, OTP verification, Google sign-in and password change. */
export const authRateLimiter: RequestHandler = chain(ipFailureLimiter, accountFailureLimiter);

/**
 * Token refresh happens silently every 15 minutes on every logged-in device (and in every open tab), so it
 * gets its own, much larger, per-IP budget instead of competing with login attempts.
 */
export const refreshRateLimiter: RequestHandler = rateLimit({
  windowMs: WINDOW_MS,
  max: env.REFRESH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

/**
 * Reset-code requests always answer 200 (so accounts cannot be enumerated), which means failures cannot be
 * counted. Count every request instead, per target e-mail, so nobody can flood a student's inbox with codes.
 */
const resetPerAccountLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: env.PASSWORD_RESET_RATE_LIMIT_MAX,
  keyGenerator: accountKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many reset requests for this account, try again later.' },
});
const resetPerIpLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: env.AUTH_IP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});
export const passwordResetRequestLimiter: RequestHandler = chain(resetPerIpLimiter, resetPerAccountLimiter);
