import { Request } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export type ActorType = 'ADMIN' | 'FACULTY' | 'STUDENT' | 'SYSTEM';

export interface AuditEntry {
  actorId?: string | null;
  actorType: ActorType;
  action: string;
  success?: boolean;
  reasonCode?: string | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Best-effort, append-only audit write. Never throws — a logging failure must
 * never block or fail the underlying request. Falls back to structured
 * Winston output if the DB write itself fails, so nothing is silently lost.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorType: entry.actorType,
        action: entry.action,
        success: entry.success ?? true,
        reasonCode: entry.reasonCode ?? null,
        sessionId: entry.sessionId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: (entry.metadata as any) ?? undefined,
      },
    });
  } catch (err: any) {
    logger.error('[audit] failed to persist audit log', { entry, error: err.message });
  }
}

/** Pulls client IP/user-agent consistently (respects trust proxy for X-Forwarded-For). */
export function requestContext(req: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
