import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';

export interface AuthPayload {
  sub: string; // user id
  role: 'ADMIN' | 'FACULTY' | 'STUDENT';
  deviceId?: string;
  /** Set while the account still uses an initial password: only change-password is allowed. */
  mcp?: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function buildAuth(allowPasswordChange: boolean, allowedRoles: Array<'ADMIN' | 'FACULTY' | 'STUDENT'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next(Errors.INVALID_JWT());

    const token = header.slice('Bearer '.length);
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return next(Errors.INVALID_JWT());
      }
      if (decoded.mcp && !allowPasswordChange) return next(Errors.PASSWORD_CHANGE_REQUIRED());
      req.auth = decoded;
      next();
    } catch {
      next(Errors.INVALID_JWT());
    }
  };
}

export function requireAuth(...allowedRoles: Array<'ADMIN' | 'FACULTY' | 'STUDENT'>) {
  return buildAuth(false, allowedRoles);
}

/** Same as requireAuth but also accepts sessions that must still change their initial password. */
export function requireAuthAllowPasswordChange(...allowedRoles: Array<'ADMIN' | 'FACULTY' | 'STUDENT'>) {
  return buildAuth(true, allowedRoles);
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export interface RefreshPayload {
  sub: string;
  role: 'ADMIN' | 'FACULTY' | 'STUDENT';
  jti: string; // unique id for this specific refresh token — enables single-token revocation
  familyId: string; // shared across all tokens descended from one login — enables reuse-detection revocation
}

/** Refresh tokens are signed with a SEPARATE secret from access tokens (blast-radius containment). */
export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL_SECONDS as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}
