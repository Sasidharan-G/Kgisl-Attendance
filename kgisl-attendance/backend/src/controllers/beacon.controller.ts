import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { stopBeaconToken } from '../services/beaconToken.service';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { issueBeaconPacket } from '../services/beacon.service';

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() }).strict();
const emptyBodySchema = z.object({}).strict();
const beaconIssueSchema = z.object({ beaconId: z.number().int().min(1).max(65535) }).strict();

export async function issueBeaconPacketHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const { beaconId } = beaconIssueSchema.parse(req.body);
    const issue = await issueBeaconPacket(sessionId, req.auth!.sub, beaconId);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'BLE_BEACON_PACKET_ISSUED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { beaconId, generationId: issue.generationId, issuedAt: issue.issuedAt, expiresAt: issue.expiresAt },
    });
    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
}

export async function revokeBeaconPacketHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    emptyBodySchema.parse(req.body ?? {});
    const revoked = await stopBeaconToken(sessionId, req.auth!.sub);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'BLE_BEACON_PACKET_REVOKED',
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
