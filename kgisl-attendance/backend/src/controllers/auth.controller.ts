import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { loginAdmin, loginFaculty, loginStudent, loginWithGoogle } from '../services/auth.service';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../utils/AppError';
import { rotateRefreshToken, revokeRefreshToken } from '../services/refreshToken.service';
import { revokeAllUserSessions } from '../services/refreshToken.service';
import { requestContext } from '../services/audit.service';
import { Errors } from '../utils/AppError';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerFacultySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/[A-Z]/, 'New password needs an uppercase letter').regex(/[a-z]/, 'New password needs a lowercase letter').regex(/[0-9]/, 'New password needs a number'),
});

const googleLoginSchema = z.object({
  credential: z.string().min(20),
  role: z.enum(['ADMIN', 'FACULTY', 'STUDENT']),
});

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

import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { redis } from '../config/redis';
import { sha256Hex } from '../utils/crypto';
import { env } from '../config/env';
import { sendPasswordResetEmail } from '../services/email.service';

export async function registerFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = registerFacultySchema.parse(req.body);
    
    const existing = await prisma.faculty.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Faculty with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.faculty.create({
      data: { name, email, passwordHash },
    });

    const result = await loginFaculty(email, password, requestContext(req));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function facultyLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginFaculty(email, password, requestContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function adminLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await loginAdmin(email, password, requestContext(req)));
  } catch (err) { next(err); }
}

export async function studentLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginStudent(email, password, requestContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Exchanges a still-valid refresh token for a new access + refresh token pair.
 * The old refresh token is single-use (rotated) — replaying it after this call
 * revokes the entire device family (see refreshToken.service).
 */
export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    if (!refreshToken) return next(Errors.INVALID_JWT());

    const ctx = requestContext(req);
    const pair = await rotateRefreshToken(refreshToken, ctx);
    res.json({ success: true, data: pair });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
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
    if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) {
      throw Errors.INVALID_CREDENTIALS();
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    if (role === 'ADMIN') await prisma.admin.update({ where: { id }, data: { passwordHash } });
    else if (role === 'FACULTY') await prisma.faculty.update({ where: { id }, data: { passwordHash } });
    else await prisma.student.update({ where: { id }, data: { passwordHash } });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) { next(err); }
}

const resetAccountSchema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), role: z.enum(['ADMIN', 'FACULTY', 'STUDENT']) });
const confirmResetSchema = resetAccountSchema.extend({
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});

const resetKey = (role: string, email: string) => `attendance:password-reset:${role}:${email}`;

export async function requestPasswordResetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = resetAccountSchema.pick({ email: true, role: true }).refine((value) => value.role !== 'ADMIN').parse(req.body);
    const account = input.role === 'FACULTY'
      ? await prisma.faculty.findUnique({ where: { email: input.email }, select: { isActive: true } })
      : await prisma.student.findUnique({ where: { email: input.email }, select: { isActive: true } });
    if (account?.isActive) {
      const code = crypto.randomInt(100000, 1000000).toString();
      await redis.set(resetKey(input.role, input.email), sha256Hex(code), 'EX', env.PASSWORD_RESET_TTL_SECONDS);
      try { await sendPasswordResetEmail(input.email, code); }
      catch (error: any) { console.error('Password reset email failed:', error.message); }
    }
    // Same response for existing and unknown accounts prevents email enumeration.
    res.json({ success: true, message: 'If an active account exists, a reset code has been sent to that email.', expiresInSeconds: env.PASSWORD_RESET_TTL_SECONDS });
  } catch (err) { next(err); }
}

export async function createPasswordResetCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = resetAccountSchema.parse(req.body);
    const account = input.role === 'ADMIN'
      ? await prisma.admin.findUnique({ where: { email: input.email } })
      : input.role === 'FACULTY'
        ? await prisma.faculty.findUnique({ where: { email: input.email } })
        : await prisma.student.findUnique({ where: { email: input.email } });
    if (!account) { res.status(404).json({ success: false, message: 'Account not found' }); return; }
    const code = crypto.randomInt(100000, 1000000).toString();
    await redis.set(resetKey(input.role, input.email), sha256Hex(code), 'EX', env.PASSWORD_RESET_TTL_SECONDS);
    res.json({ success: true, data: { code, expiresInSeconds: env.PASSWORD_RESET_TTL_SECONDS }, message: 'One-time reset code created. Share it securely with the account owner.' });
  } catch (err) { next(err); }
}

export async function confirmPasswordResetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = confirmResetSchema.parse(req.body);
    const key = resetKey(input.role, input.email);
    const expectedHash = await redis.get(key);
    if (!expectedHash || expectedHash !== sha256Hex(input.code)) {
      res.status(400).json({ success: false, code: 'INVALID_RESET_CODE', message: 'Reset code is invalid or expired.' });
      return;
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    const account = input.role === 'ADMIN'
      ? await prisma.admin.update({ where: { email: input.email }, data: { passwordHash } })
      : input.role === 'FACULTY'
        ? await prisma.faculty.update({ where: { email: input.email }, data: { passwordHash } })
        : await prisma.student.update({ where: { email: input.email }, data: { passwordHash } });
    await redis.del(key);
    await revokeAllUserSessions(account.id, input.role);
    res.json({ success: true, message: 'Password reset successfully. The code can no longer be used.' });
  } catch (err) { next(err); }
}
