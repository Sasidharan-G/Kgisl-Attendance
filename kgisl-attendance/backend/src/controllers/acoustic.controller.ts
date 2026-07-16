import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { issueAcousticToken, stopAcousticToken } from '../services/acoustic.service';
import { requestContext, writeAuditLog } from '../services/audit.service';

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() }).strict();
const emptyBodySchema = z.object({}).strict();

export async function issueAcousticTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    emptyBodySchema.parse(req.body ?? {});
    const issue = await issueAcousticToken(sessionId, req.auth!.sub);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'ACOUSTIC_TOKEN_ISSUED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      // generationId/timestamps are safe metadata; the bearer token and digest are omitted.
      metadata: {
        generationId: issue.generationId,
        issuedAt: issue.issuedAt,
        expiresAt: issue.expiresAt,
      },
    });
    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
}

export async function revokeAcousticTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    emptyBodySchema.parse(req.body ?? {});
    const revoked = await stopAcousticToken(sessionId, req.auth!.sub);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'ACOUSTIC_TOKEN_REVOKED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { revoked },
    });
    res.status(200).json({ success: true, data: { revoked } });
  } catch (err) {
    next(err);
  }
}
