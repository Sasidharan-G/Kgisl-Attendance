import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { loginFaculty, loginStudent } from '../services/auth.service';
import { rotateRefreshToken, revokeRefreshToken } from '../services/refreshToken.service';
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

import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

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
