import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateAndRecordBeaconScan, validateAndRecordScan } from '../services/validation.service';
import { writeAuditLog, requestContext } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { assertPasskeyNotRequired, verifyPasskeyAssertion } from '../services/passkey.service';
import { authenticationResponseSchema } from '../utils/passkeySchemas';
import { isPasskeyDeviceId } from '../utils/passkey';

const gpsSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().positive().max(10_000),
}).strict();

// "pk:" ids are derived server-side from a verified passkey and can never be client-supplied.
const deviceIdSchema = z.string().trim().min(1, 'deviceId is required').max(256).refine((value) => !isPasskeyDeviceId(value), 'Invalid deviceId');

const qrScanSchema = z.object({
  deviceId: deviceIdSchema,
  gps: gpsSchema,
  // Face ID / Touch ID assertion; present for passkey-bound web students.
  passkey: authenticationResponseSchema.optional(),
  qr: z.object({
    sessionId: z.string().uuid(),
    token: z.string().min(20).max(256),
    issuedAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    nonce: z.string().regex(/^[0-9a-f]{32}$/i),
    signature: z.string().min(10).max(256),
  }).strict(),
}).strict();

const beaconScanSchema = z.object({
  packet: z.string().regex(/^[A-Za-z0-9_-]{28}$/),
  rssi: z.number().int().min(-127).max(20),
  deviceId: deviceIdSchema,
  gps: gpsSchema,
  passkey: authenticationResponseSchema.optional(),
}).strict();

/**
 * Passkey-bound accounts must prove the enrolled device with Face ID / Touch ID, and the effective device id is then
 * derived from the verified credential instead of being trusted from the client.
 */
async function resolveDeviceId(studentId: string, deviceId: string, passkey: unknown): Promise<string> {
  if (passkey) return verifyPasskeyAssertion(studentId, passkey as never);
  await assertPasskeyNotRequired(studentId);
  return deviceId;
}

function sendSuccess(res: Response, result: Awaited<ReturnType<typeof validateAndRecordScan>>, gpsAccuracy: number): void {
  res.status(201).json({
    success: true,
    code: 'ATTENDANCE_MARKED',
    message: 'Attendance marked successfully.',
    data: {
      attendanceId: result.record.id,
      sessionId: result.sessionId,
      studentId: result.student.id,
      studentName: result.student.name,
      rollNo: result.student.rollNo,
      subjectName: result.subjectName,
      status: result.record.status,
      method: result.record.method,
      markedAt: result.record.scanTime.toISOString(),
      distanceMeters: Math.round(result.distanceMeters),
      gpsAccuracy,
    },
  });
}

export async function scanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ctx = requestContext(req);
  // Identity comes exclusively from the verified JWT, never from the body.
  const studentId = req.auth!.sub;
  try {
    const body = qrScanSchema.parse(req.body);
    const deviceId = await resolveDeviceId(studentId, body.deviceId, body.passkey);
    const result = await validateAndRecordScan({ studentId, deviceId, gps: body.gps, qr: body.qr });

    await writeAuditLog({
      actorId: studentId,
      actorType: 'STUDENT',
      action: 'QR_SCAN_ACCEPTED',
      sessionId: result.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { method: 'QR', gps: body.gps, distanceMeters: result.distanceMeters },
    });
    sendSuccess(res, result, body.gps.accuracy);
  } catch (err) {
    await writeAuditLog({
      actorId: studentId,
      actorType: 'STUDENT',
      action: 'QR_SCAN_REJECTED',
      success: false,
      reasonCode: err instanceof AppError ? err.code : 'UNKNOWN_ERROR',
      sessionId: typeof req.body?.qr?.sessionId === 'string' ? req.body.qr.sessionId : null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { method: 'QR' },
    });
    next(err);
  }
}

export async function beaconScanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ctx = requestContext(req);
  const studentId = req.auth!.sub;
  try {
    const { passkey, ...body } = beaconScanSchema.parse(req.body);
    const deviceId = await resolveDeviceId(studentId, body.deviceId, passkey);
    const result = await validateAndRecordBeaconScan({ studentId, ...body, deviceId });

    await writeAuditLog({
      actorId: studentId,
      actorType: 'STUDENT',
      action: 'BLE_BEACON_SCAN_ACCEPTED',
      sessionId: result.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { method: 'BEACON', rssi: body.rssi, gps: body.gps, distanceMeters: result.distanceMeters },
    });
    sendSuccess(res, result, body.gps.accuracy);
  } catch (err) {
    await writeAuditLog({
      actorId: studentId,
      actorType: 'STUDENT',
      action: 'BLE_BEACON_SCAN_REJECTED',
      success: false,
      reasonCode: err instanceof AppError ? err.code : 'UNKNOWN_ERROR',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { method: 'BEACON' },
    });
    next(err);
  }
}
