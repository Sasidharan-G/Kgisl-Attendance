import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { issueTokenPair } from './refreshToken.service';
import { writeAuditLog } from './audit.service';
import { Errors } from '../utils/AppError';

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
