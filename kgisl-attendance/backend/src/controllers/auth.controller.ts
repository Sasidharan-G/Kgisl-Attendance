import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { beginAdminEmailMfa, loginFaculty, loginStudent, loginWithGoogle, verifyAdminEmailMfa } from '../services/auth.service';
import { findAdminByEmail, findFacultyByEmail, findStudentByEmail } from '../services/accountLookup';
import { AppError, Errors } from '../utils/AppError';
import { rotateRefreshToken, revokeRefreshToken, issueTokenPair, revokeAllUserSessions } from '../services/refreshToken.service';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { sha256Hex } from '../utils/crypto';
import { logger } from '../utils/logger';
import type { Role } from '../middleware/auth.middleware';

// E-mails are trimmed (phone keyboards and autofill often append a space); passwords never are.
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
const adminMfaVerifySchema = z.object({ email: z.string().trim().email(), code: z.string().trim().regex(/^\d{6}$/) });
const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const googleLoginSchema = z.object({ credential: z.string().min(20), role: z.enum(['ADMIN', 'FACULTY', 'STUDENT']) });

const strongPassword = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[0-9]/, 'Password needs a number');
const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: strongPassword });

const accountSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(['ADMIN', 'FACULTY', 'STUDENT']),
});
const confirmResetSchema = accountSchema.extend({ code: z.string().trim().regex(/^\d{6}$/), newPassword: strongPassword });

const BCRYPT_ROUNDS = 12;
const resetKey = (role: string, email: string) => `attendance:password-reset:${role}:${email}`;

function findAccount(role: Role, email: string) {
  if (role === 'ADMIN') return findAdminByEmail(email);
  if (role === 'FACULTY') return findFacultyByEmail(email);
  return findStudentByEmail(email);
}

async function storeResetCode(role: Role, email: string): Promise<string> {
  const code = crypto.randomInt(100000, 1000000).toString();
  await redis.set(resetKey(role, email), sha256Hex(code), 'EX', env.PASSWORD_RESET_TTL_SECONDS);
  return code;
}

export function googleAuthConfigHandler(_req: Request, res: Response) {
  res.json({ success: true, data: { enabled: Boolean(env.GOOGLE_CLIENT_ID), clientId: env.GOOGLE_CLIENT_ID || null } });
}

export async function googleLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!env.GOOGLE_CLIENT_ID) throw new AppError('GOOGLE_AUTH_NOT_CONFIGURED', 'Google sign-in is not configured yet.', 503);
    const { credential, role } = googleLoginSchema.parse(req.body);
    const ticket = await new OAuth2Client(env.GOOGLE_CLIENT_ID).verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) throw new AppError('INVALID_GOOGLE_TOKEN', 'Google account verification failed.', 401);
    res.json(await loginWithGoogle(payload.email, role, requestContext(req)));
  } catch (err) { next(err); }
}

export async function facultyLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await loginFaculty(email, password, requestContext(req)));
  } catch (err) { next(err); }
}

export async function studentLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await loginStudent(email, password, requestContext(req)));
  } catch (err) { next(err); }
}

export async function adminLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    res.json({ success: true, data: await beginAdminEmailMfa(email, password, requestContext(req)) });
  } catch (err) { next(err); }
}

export async function verifyAdminMfaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, code } = adminMfaVerifySchema.parse(req.body);
    res.json(await verifyAdminEmailMfa(email, code, requestContext(req)));
  } catch (err) { next(err); }
}

/**
 * Exchanges a still-valid refresh token for a new access + refresh token pair. The old refresh token is single-use
 * (rotated): replaying it after this call revokes the whole login family (see refreshToken.service).
 */
export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json({ success: true, data: await rotateRefreshToken(refreshToken, requestContext(req)) });
  } catch (err) { next(err); }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const { sub: id, role } = req.auth!;
    const account = role === 'ADMIN'
      ? await prisma.admin.findUnique({ where: { id } })
      : role === 'FACULTY'
        ? await prisma.faculty.findUnique({ where: { id } })
        : await prisma.student.findUnique({ where: { id } });
    if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) throw Errors.INVALID_CREDENTIALS();
    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, code: 'PASSWORD_UNCHANGED', message: 'Choose a password different from the current one.' });
      return;
    }
    const emailName = account.email.split('@')[0].toLowerCase();
    if (emailName.length >= 4 && newPassword.toLowerCase().includes(emailName)) {
      res.status(400).json({ success: false, code: 'PASSWORD_TOO_GUESSABLE', message: 'Do not use your email name inside the password.' });
      return;
    }
    const data = { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), mustChangePassword: false };
    if (role === 'ADMIN') await prisma.admin.update({ where: { id }, data });
    else if (role === 'FACULTY') await prisma.faculty.update({ where: { id }, data });
    else await prisma.student.update({ where: { id }, data });

    // Every old session (including a stolen one) is signed out; this device gets a fresh, ungated pair.
    await revokeAllUserSessions(id, role);
    const { accessToken, refreshToken, expiresIn } = await issueTokenPair(id, role);
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: id, actorType: role, action: 'PASSWORD_CHANGED', ip: ctx.ip, userAgent: ctx.userAgent });
    res.json({ success: true, message: 'Password updated successfully.', data: { token: accessToken, refreshToken, expiresIn } });
  } catch (err) { next(err); }
}

/** Self-service reset for faculty and students: a 6-digit code is e-mailed. The answer never reveals whether the account exists. */
export async function requestPasswordResetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = accountSchema.refine((value) => value.role !== 'ADMIN', { message: 'Administrators ask another administrator for a reset code.' }).parse(req.body);
    const account = await findAccount(input.role, input.email);
    if (account?.isActive) {
      const code = await storeResetCode(input.role, input.email);
      try { await sendPasswordResetEmail(input.email, code); }
      catch (error) { logger.error('[password-reset] e-mail delivery failed', { error: (error as Error).message }); }
    }
    res.json({
      success: true,
      message: 'If an active account exists, a reset code has been sent to that e-mail.',
      expiresInSeconds: env.PASSWORD_RESET_TTL_SECONDS,
    });
  } catch (err) { next(err); }
}

/** Administrator hands a one-time reset code to the account owner (used when e-mail delivery is not available). */
export async function createPasswordResetCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = accountSchema.parse(req.body);
    const account = await findAccount(input.role, input.email);
    if (!account) {
      res.status(404).json({ success: false, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
      return;
    }
    const code = await storeResetCode(input.role, input.email);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'ADMIN',
      action: 'PASSWORD_RESET_CODE_ISSUED',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { role: input.role, email: input.email },
    });
    res.json({ success: true, data: { code, expiresInSeconds: env.PASSWORD_RESET_TTL_SECONDS } });
  } catch (err) { next(err); }
}

export async function confirmPasswordResetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = confirmResetSchema.parse(req.body);
    const key = resetKey(input.role, input.email);
    const invalid = () => res.status(400).json({ success: false, code: 'INVALID_RESET_CODE', message: 'Reset code is invalid or expired.' });

    const expectedHash = await redis.get(key);
    if (!expectedHash || expectedHash !== sha256Hex(input.code)) { invalid(); return; }
    const target = await findAccount(input.role, input.email);
    if (!target) { invalid(); return; }

    const data = { passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS), mustChangePassword: false };
    if (input.role === 'ADMIN') await prisma.admin.update({ where: { id: target.id }, data });
    else if (input.role === 'FACULTY') await prisma.faculty.update({ where: { id: target.id }, data });
    else await prisma.student.update({ where: { id: target.id }, data });

    await redis.del(key);
    await revokeAllUserSessions(target.id, input.role);
    res.json({ success: true, message: 'Password reset successfully. The code can no longer be used.' });
  } catch (err) { next(err); }
}
