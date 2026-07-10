import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateAndRecordScan } from '../services/validation.service';
import { writeAuditLog, requestContext } from '../services/audit.service';
import { AppError } from '../utils/AppError';

const scanSchema = z.object({
  batchId: z.string().uuid('batchId must be a valid UUID'),
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
  deviceId: z.string().min(1, 'deviceId is required'),
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    // accuracy in metres — optional but used for quality checks when present
    accuracy: z.number().positive().optional(),
  }),
  // Wi-Fi fields accepted but not enforced (browsers cannot reliably read SSID)
  wifi: z
    .object({
      ssid: z.string().optional(),
      referenceKey: z.string().optional(),
    })
    .optional(),
  qr: z.object({
    sessionId: z.string().uuid(),
    token: z.string().min(20),
    issuedAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    nonce: z.string().length(32), // 16-byte hex nonce
    signature: z.string().min(10),
  }),
});

export async function scanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ctx = requestContext(req);
  // Identity comes exclusively from the verified JWT — never from the request body.
  const studentId = req.auth?.sub;

  try {
    const body = scanSchema.parse(req.body);

    const result = await validateAndRecordScan({
      studentId: studentId!,
      deviceId: body.deviceId,
      batchIdClaimed: body.batchId,
      subjectIdClaimed: body.subjectId,
      gps: body.gps,
      qr: body.qr,
    });

    await writeAuditLog({
      actorId: studentId,
      actorType: 'STUDENT',
      action: 'SCAN_ACCEPTED',
      sessionId: body.qr.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        gps: { lat: body.gps.lat, lng: body.gps.lng },
        distanceMeters: result.distanceMeters,
      },
    });

    res.status(201).json({
      success: true,
      code: 'ATTENDANCE_MARKED',
      message: 'Attendance marked successfully.',
      data: {
        attendanceId: result.record.id,
        sessionId: body.qr.sessionId,
        studentId: result.student.id,
        studentName: result.student.name,
        rollNo: result.student.rollNo,
        subjectName: result.subjectName,
        status: result.record.status,
        markedAt: result.record.scanTime.toISOString(),
        distanceMeters: Math.round(result.distanceMeters),
      },
    });
  } catch (err) {
    // Every rejection is captured for the audit trail — AppError.code or UNKNOWN_ERROR.
    await writeAuditLog({
      actorId: studentId,
      actorType: 'STUDENT',
      action: 'SCAN_REJECTED',
      success: false,
      reasonCode: err instanceof AppError ? err.code : 'UNKNOWN_ERROR',
      sessionId: (req.body?.qr?.sessionId as string) ?? null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    next(err);
  }
}
