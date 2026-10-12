import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { issueTokenPair } from './refreshToken.service';
import { writeAuditLog } from './audit.service';
import { Errors } from '../utils/AppError';
import { redis } from '../config/redis';
import { sha256Hex } from '../utils/crypto';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { isEmailDeliveryConfigured, sendAdminLoginOtp } from './email.service';
import { findAdminByEmail, findFacultyByEmail, findStudentByEmail } from './accountLookup';
import type { Role } from '../middleware/auth.middleware';

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

interface AccountRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  rollNo?: string;
}

/** Compared against when the e-mail is unknown, so a wrong e-mail and a wrong password take equally long. */
const UNKNOWN_ACCOUNT_HASH = bcrypt.hashSync('unknown-account-timing-guard', 10);

const adminMfaKey = (email: string) => `attendance:admin-mfa:${email}`;
const ADMIN_MFA_TTL_SECONDS = 600;

function lookup(role: Role, email: string): Promise<AccountRow | null> {
  if (role === 'ADMIN') return findAdminByEmail(email);
  if (role === 'FACULTY') return findFacultyByEmail(email);
  return findStudentByEmail(email);
}

function presentUser(role: Role, account: AccountRow) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role,
    ...(account.rollNo ? { rollNo: account.rollNo } : {}),
  };
}

async function verifyPassword(role: Role, email: string, password: string, ctx: LoginContext): Promise<AccountRow> {
  const account = await lookup(role, email);
  if (env.AUTH_BYPASS) {
    // Demo mode: the password is not checked. An unknown admin e-mail falls back to the first active administrator.
    const target = account ?? (role === 'ADMIN' ? await prisma.admin.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }) : null);
    if (!target) throw Errors.INVALID_CREDENTIALS();
    if (!target.isActive) throw Errors.ACCOUNT_INACTIVE();
    return target;
  }
  const matches = await bcrypt.compare(password, account?.passwordHash ?? UNKNOWN_ACCOUNT_HASH);
  if (!account || !matches) {
    await writeAuditLog({
      actorId: account?.id ?? null,
      actorType: role,
      action: 'LOGIN_FAILED',
      success: false,
      reasonCode: 'INVALID_CREDENTIALS',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { email },
    });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!account.isActive) throw Errors.ACCOUNT_INACTIVE();
  return account;
}

async function startSession(
  role: Role,
  account: AccountRow,
  ctx: LoginContext,
  action: string,
  options: { passwordGate?: boolean } = {}
) {
  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(account.id, role, options);
  await writeAuditLog({ actorId: account.id, actorType: role, action, ip: ctx.ip, userAgent: ctx.userAgent });
  return { token: accessToken, refreshToken, expiresIn, user: presentUser(role, account) };
}

export async function loginWithGoogle(email: string, role: Role, ctx: LoginContext) {
  const account = await lookup(role, email.toLowerCase());
  if (!account) {
    await writeAuditLog({
      actorType: role,
      action: 'GOOGLE_LOGIN_FAILED',
      success: false,
      reasonCode: 'ACCOUNT_NOT_FOUND',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { email: email.toLowerCase() },
    });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!account.isActive) throw Errors.ACCOUNT_INACTIVE();
  // Google sign-in has no initial password to replace, so the forced password change does not apply.
  return startSession(role, account, ctx, 'GOOGLE_LOGIN_SUCCESS', { passwordGate: false });
}

export async function loginFaculty(email: string, password: string, ctx: LoginContext) {
  return startSession('FACULTY', await verifyPassword('FACULTY', email, password, ctx), ctx, 'LOGIN_SUCCESS', { passwordGate: !env.AUTH_BYPASS });
}

export async function loginStudent(email: string, password: string, ctx: LoginContext) {
  return startSession('STUDENT', await verifyPassword('STUDENT', email, password, ctx), ctx, 'LOGIN_SUCCESS', { passwordGate: !env.AUTH_BYPASS });
}

/**
 * Admin sign-in step 1: the password. When e-mail delivery works the admin must also enter the 6-digit code that was
 * mailed; when it is not configured (or the provider is down) the password alone signs in, so the portal can never
 * lock its only administrator out.
 */
export async function beginAdminEmailMfa(email: string, password: string, ctx: LoginContext) {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await verifyPassword('ADMIN', normalizedEmail, password, ctx);

  if (env.AUTH_BYPASS) return startSession('ADMIN', admin, ctx, 'ADMIN_LOGIN_BYPASS', { passwordGate: false });

  if (isEmailDeliveryConfigured()) {
    const code = crypto.randomInt(100000, 1000000).toString();
    try {
      await redis.set(adminMfaKey(normalizedEmail), sha256Hex(code), 'EX', ADMIN_MFA_TTL_SECONDS);
      await sendAdminLoginOtp(normalizedEmail, code);
      await writeAuditLog({ actorId: admin.id, actorType: 'ADMIN', action: 'ADMIN_MFA_OTP_SENT', ip: ctx.ip, userAgent: ctx.userAgent });
      return { mfaRequired: true as const, email: normalizedEmail, expiresInSeconds: ADMIN_MFA_TTL_SECONDS };
    } catch (error) {
      logger.warn('[auth] admin sign-in code could not be e-mailed; signing in with the password only', { error: (error as Error).message });
      await redis.del(adminMfaKey(normalizedEmail)).catch(() => undefined);
    }
  }
  return startSession('ADMIN', admin, ctx, 'ADMIN_LOGIN_MFA_UNAVAILABLE');
}

export async function verifyAdminEmailMfa(email: string, code: string, ctx: LoginContext) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = adminMfaKey(normalizedEmail);
  const expected = await redis.get(key);
  if (!expected || expected !== sha256Hex(code)) throw Errors.INVALID_CREDENTIALS();
  await redis.del(key);
  const admin = await findAdminByEmail(normalizedEmail);
  if (!admin || !admin.isActive) throw Errors.INVALID_CREDENTIALS();
  return startSession('ADMIN', admin, ctx, 'ADMIN_MFA_LOGIN_SUCCESS');
}
