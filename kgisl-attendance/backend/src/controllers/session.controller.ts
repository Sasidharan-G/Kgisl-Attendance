import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  cancelSession,
  endSession,
  getActiveSession,
  pauseSession,
  resumeSession,
  startExtraSession,
  startSession,
} from '../services/session.service';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { overrideAttendance } from '../services/attendance.service';
import { broadcastAttendanceCorrected } from '../websocket/socket';

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() }).strict();
const startSchema = z.object({
  allocationId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roomId: z.string().uuid(),
  batchId: z.string().uuid(),
}).strict();
const extraSessionSchema = z.object({
  subjectId: z.string().uuid(),
  roomId: z.string().uuid(),
  batchId: z.string().uuid(),
  durationMinutes: z.number().int().min(15).max(180),
  reason: z.string().trim().min(3).max(200),
}).strict();
const correctionSchema = z.object({
  rollNo: z.string().trim().min(1).max(64),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'ON_DUTY', 'LEAVE']),
  reason: z.string().trim().min(3).max(500),
}).strict();

/** Runs an action on one of the signed-in faculty member's sessions and writes the matching audit entry. */
function sessionAction<T>(
  action: string,
  run: (sessionId: string, facultyId: string) => Promise<T>,
  options: { respond?: (value: T, res: Response) => void } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const facultyId = req.auth!.sub;
      const result = await run(sessionId, facultyId);
      const ctx = requestContext(req);
      await writeAuditLog({
        actorId: facultyId,
        actorType: 'FACULTY',
        action,
        // A cancelled session no longer exists, so the audit row cannot point at it.
        sessionId: action === 'SESSION_CANCELLED' ? null : sessionId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: action === 'SESSION_CANCELLED' ? { cancelledSessionId: sessionId } : undefined,
      });
      if (options.respond) options.respond(result, res);
      else res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const endSessionHandler = sessionAction('SESSION_ENDED', endSession);
export const pauseSessionHandler = sessionAction('SESSION_PAUSED', pauseSession);
export const resumeSessionHandler = sessionAction('SESSION_RESUMED', resumeSession);
export const cancelSessionHandler = sessionAction('SESSION_CANCELLED', cancelSession, {
  respond: (_value, res) => res.json({ success: true, message: 'Session cancelled. It will not appear in attendance reports.' }),
});

export async function startSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = startSchema.parse(req.body);
    const facultyId = req.auth!.sub;
    const session = await startSession({ facultyId, ...body });
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: facultyId, actorType: 'FACULTY', action: 'SESSION_STARTED', sessionId: session.sessionId, ip: ctx.ip, userAgent: ctx.userAgent, metadata: body });
    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
}

export async function startExtraSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = extraSessionSchema.parse(req.body);
    const session = await startExtraSession({ facultyId: req.auth!.sub, ...body });
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'EXTRA_SESSION_STARTED',
      sessionId: session.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { durationMinutes: body.durationMinutes, reason: body.reason },
    });
    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
}

export async function getActiveSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await getActiveSession(req.auth!.sub) });
  } catch (err) { next(err); }
}

/** Faculty override of one student's mark: PRESENT/ABSENT/LATE/ON_DUTY/LEAVE with a mandatory reason. */
export async function correctAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const input = correctionSchema.parse(req.body);
    const result = await overrideAttendance({
      sessionId,
      facultyId: req.auth!.sub,
      rollNo: input.rollNo,
      status: input.status,
      reason: input.reason,
    });
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: result.created ? 'MANUAL_ATTENDANCE_CREATED' : 'ATTENDANCE_OVERRIDDEN',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        rollNo: result.student.rollNo,
        previousStatus: result.previousStatus,
        status: result.record.status,
        originalMethod: result.originalMethod,
        reason: input.reason,
      },
    });
    broadcastAttendanceCorrected(sessionId, {
      studentId: result.student.id,
      studentName: result.student.name,
      studentRoll: result.student.rollNo,
      status: result.record.status,
      method: result.record.method,
      updatedAt: result.record.updatedAt.toISOString(),
    });
    res.status(result.created ? 201 : 200).json({
      success: true,
      message: `Attendance changed to ${input.status}.`,
      data: {
        attendanceId: result.record.id,
        studentId: result.student.id,
        rollNo: result.student.rollNo,
        status: result.record.status,
        method: result.record.method,
        previousStatus: result.previousStatus,
        originalMethod: result.originalMethod,
        updatedAt: result.record.updatedAt.toISOString(),
      },
    });
  } catch (err) { next(err); }
}
