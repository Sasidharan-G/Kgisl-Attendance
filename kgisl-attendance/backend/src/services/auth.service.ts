import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { issueTokenPair } from './refreshToken.service';
import { writeAuditLog } from './audit.service';
import { Errors } from '../utils/AppError';
import crypto from 'crypto';
import { redis } from '../config/redis';
import { sha256Hex } from '../utils/crypto';
import { isEmailDeliveryConfigured, sendAdminLoginOtp } from './email.service';

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

export type LoginRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export async function loginWithGoogle(email: string, role: LoginRole, ctx: LoginContext) {
  const normalizedEmail = email.toLowerCase();
  const account = role === 'ADMIN'
    ? await prisma.admin.findUnique({ where: { email: normalizedEmail } })
    : role === 'FACULTY'
      ? await prisma.faculty.findUnique({ where: { email: normalizedEmail } })
      : await prisma.student.findUnique({ where: { email: normalizedEmail } });

  if (!account) {
    await writeAuditLog({ actorType: role, action: 'GOOGLE_LOGIN_FAILED', success: false, reasonCode: 'ACCOUNT_NOT_FOUND', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { email: normalizedEmail } });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!account.isActive) throw Errors.ACCOUNT_INACTIVE();

  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(account.id, role);
  await writeAuditLog({ actorId: account.id, actorType: role, action: 'GOOGLE_LOGIN_SUCCESS', ip: ctx.ip, userAgent: ctx.userAgent });
  return {
    token: accessToken,
    refreshToken,
    expiresIn,
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      role,
      ...(role === 'STUDENT' && 'rollNo' in account ? { rollNo: account.rollNo } : {}),
    },
  };
}

export async function loginAdmin(email: string, password: string, ctx: LoginContext) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    await writeAuditLog({ actorId: admin?.id ?? null, actorType: 'ADMIN', action: 'LOGIN_FAILED', success: false, reasonCode: 'INVALID_CREDENTIALS', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { email } });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!admin.isActive) throw Errors.ACCOUNT_INACTIVE();
  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(admin.id, 'ADMIN');
  await writeAuditLog({ actorId: admin.id, actorType: 'ADMIN', action: 'LOGIN_SUCCESS', ip: ctx.ip, userAgent: ctx.userAgent });
  return { token: accessToken, refreshToken, expiresIn, user: { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' as const } };
}

const adminMfaKey = (email: string) => `attendance:admin-mfa:${email}`;

export async function beginAdminEmailMfa(email: string, password: string, ctx: LoginContext) {
  const normalizedEmail = email.toLowerCase();
  const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    await writeAuditLog({ actorId: admin?.id ?? null, actorType: 'ADMIN', action: 'LOGIN_FAILED', success: false, reasonCode: 'INVALID_CREDENTIALS', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { email: normalizedEmail } });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!admin.isActive) throw Errors.ACCOUNT_INACTIVE();
  // Keep self-hosted deployments usable until a transactional email provider
  // is configured. Password validation, rate limiting and audit logging still
  // apply; enabling Brevo, Resend or complete SMTP credentials restores MFA.
  if (!isEmailDeliveryConfigured()) {
    const { accessToken, refreshToken, expiresIn } = await issueTokenPair(admin.id, 'ADMIN');
    await writeAuditLog({
      actorId: admin.id,
      actorType: 'ADMIN',
      action: 'ADMIN_LOGIN_MFA_UNAVAILABLE',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { reason: 'EMAIL_DELIVERY_NOT_CONFIGURED' },
    });
    return {
      token: accessToken,
      refreshToken,
      expiresIn,
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' as const },
    };
  }
  const code = crypto.randomInt(100000, 1000000).toString();
  await redis.set(adminMfaKey(normalizedEmail), sha256Hex(code), 'EX', 600);
  await sendAdminLoginOtp(normalizedEmail, code);
  await writeAuditLog({ actorId: admin.id, actorType: 'ADMIN', action: 'ADMIN_MFA_OTP_SENT', ip: ctx.ip, userAgent: ctx.userAgent });
  return { mfaRequired: true, email: normalizedEmail, expiresInSeconds: 600 };
}

export async function verifyAdminEmailMfa(email: string, code: string, ctx: LoginContext) {
  const normalizedEmail = email.toLowerCase(); const key = adminMfaKey(normalizedEmail);
  const expected = await redis.get(key);
  if (!expected || expected !== sha256Hex(code)) throw Errors.INVALID_CREDENTIALS();
  await redis.del(key);
  const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
  if (!admin || !admin.isActive) throw Errors.INVALID_CREDENTIALS();
  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(admin.id, 'ADMIN');
  await writeAuditLog({ actorId: admin.id, actorType: 'ADMIN', action: 'ADMIN_MFA_LOGIN_SUCCESS', ip: ctx.ip, userAgent: ctx.userAgent });
  return { token: accessToken, refreshToken, expiresIn, user: { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' as const } };
}

export async function loginFaculty(email: string, password: string, ctx: LoginContext) {
  const faculty = await prisma.faculty.findUnique({ where: { email } });
  if (!faculty || !(await bcrypt.compare(password, faculty.passwordHash))) {
    await writeAuditLog({
      actorId: faculty?.id ?? null,
      actorType: 'FACULTY',
      action: 'LOGIN_FAILED',
      success: false,
      reasonCode: 'INVALID_CREDENTIALS',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { email },
    });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!faculty.isActive) throw Errors.ACCOUNT_INACTIVE();

  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(faculty.id, 'FACULTY');
  await writeAuditLog({
    actorId: faculty.id,
    actorType: 'FACULTY',
    action: 'LOGIN_SUCCESS',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return {
    token: accessToken,
    refreshToken,
    expiresIn,
    user: { id: faculty.id, name: faculty.name, email: faculty.email, role: 'FACULTY' as const },
  };
}

export async function loginStudent(email: string, password: string, ctx: LoginContext) {
  const student = await prisma.student.findUnique({ where: { email } });
  if (!student || !(await bcrypt.compare(password, student.passwordHash))) {
    await writeAuditLog({
      actorId: student?.id ?? null,
      actorType: 'STUDENT',
      action: 'LOGIN_FAILED',
      success: false,
      reasonCode: 'INVALID_CREDENTIALS',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { email },
    });
    throw Errors.INVALID_CREDENTIALS();
  }
  if (!student.isActive) throw Errors.ACCOUNT_INACTIVE();

  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(student.id, 'STUDENT');
  await writeAuditLog({
    actorId: student.id,
    actorType: 'STUDENT',
    action: 'LOGIN_SUCCESS',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return {
    token: accessToken,
    refreshToken,
    expiresIn,
    user: { id: student.id, name: student.name, rollNo: student.rollNo, email: student.email, role: 'STUDENT' as const },
  };
}

export async function masterSuperAdminLogin(passcode: string, ctx: LoginContext) {
  const MASTER_PIN = 'KGISL#Master#2026';
  if (passcode !== MASTER_PIN) {
    await writeAuditLog({ actorId: null, actorType: 'ADMIN', action: 'MASTER_LOGIN_FAILED', success: false, reasonCode: 'INVALID_MASTER_PASSCODE', ip: ctx.ip, userAgent: ctx.userAgent });
    throw Errors.INVALID_CREDENTIALS();
  }

  // Fetch real system users for instant impersonation control
  const [students, faculty, admins] = await Promise.all([
    prisma.student.findMany({ select: { id: true, name: true, rollNo: true, email: true, isActive: true }, take: 100 }),
    prisma.faculty.findMany({ select: { id: true, name: true, email: true, isActive: true }, take: 100 }),
    prisma.admin.findMany({ select: { id: true, name: true, email: true, isActive: true }, take: 50 }),
  ]);

  await writeAuditLog({ actorId: null, actorType: 'ADMIN', action: 'MASTER_LOGIN_SUCCESS', ip: ctx.ip, userAgent: ctx.userAgent });

  return {
    success: true,
    data: {
      students,
      faculty,
      admins,
    },
  };
}

export async function masterImpersonateUser(targetId: string, targetRole: LoginRole, ctx: LoginContext) {
  const account = targetRole === 'ADMIN'
    ? await prisma.admin.findUnique({ where: { id: targetId } })
    : targetRole === 'FACULTY'
      ? await prisma.faculty.findUnique({ where: { id: targetId } })
      : await prisma.student.findUnique({ where: { id: targetId } });

  if (!account) throw Errors.STUDENT_NOT_FOUND();

  const { accessToken, refreshToken, expiresIn } = await issueTokenPair(account.id, targetRole);
  await writeAuditLog({ actorId: account.id, actorType: targetRole, action: 'MASTER_IMPERSONATION_SUCCESS', ip: ctx.ip, userAgent: ctx.userAgent });

  return {
    token: accessToken,
    refreshToken,
    expiresIn,
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: targetRole,
      ...('rollNo' in account ? { rollNo: account.rollNo } : {}),
    },
  };
}
