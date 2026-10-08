import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  beginPasskeyAuthentication,
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  getPasskeyStatus,
} from '../services/passkey.service';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { registrationResponseSchema } from '../utils/passkeySchemas';

export async function passkeyStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await getPasskeyStatus(req.auth!.sub) });
  } catch (err) { next(err); }
}

export async function registerOptionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await beginPasskeyRegistration(req.auth!.sub) });
  } catch (err) { next(err); }
}

export async function registerVerifyHandler(req: Request, res: Response, next: NextFunction) {
  const ctx = requestContext(req);
  const studentId = req.auth!.sub;
  try {
    const response = registrationResponseSchema.parse(req.body);
    const result = await finishPasskeyRegistration(studentId, response as never);
    await writeAuditLog({ actorId: studentId, actorType: 'STUDENT', action: 'PASSKEY_REGISTERED', ip: ctx.ip, userAgent: ctx.userAgent });
    res.status(201).json({ success: true, data: { enrolled: true, credentialId: result.credentialId } });
  } catch (err) {
    await writeAuditLog({
      actorId: studentId, actorType: 'STUDENT', action: 'PASSKEY_REGISTER_FAILED', success: false,
      reasonCode: err instanceof AppError ? err.code : 'UNKNOWN_ERROR', ip: ctx.ip, userAgent: ctx.userAgent,
    });
    next(err);
  }
}

export async function authOptionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    z.object({}).strict().parse(req.body ?? {});
    res.json({ success: true, data: await beginPasskeyAuthentication(req.auth!.sub) });
  } catch (err) { next(err); }
}
