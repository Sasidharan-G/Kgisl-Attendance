import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  endSession,
  getActiveSession,
  getSessionPublicInfo,
  getSessionStats,
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
const manualAttendanceSchema = z.object({
  rollNo: z.string().trim().min(1).max(64),
  status: z.enum(['PRESENT', 'ABSENT']),
  reason: z.string().trim().min(3).max(500),
}).strict();
const correctionSchema = z.object({
  rollNo: z.string().trim().min(1).max(64),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'ON_DUTY', 'LEAVE']),
  reason: z.string().trim().min(3).max(500),
}).strict();

export async function startSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = startSchema.parse(req.body);
    const facultyId = req.auth!.sub;
    const session = await startSession({ facultyId, ...body });
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: facultyId,
      actorType: 'FACULTY',
      action: 'SESSION_STARTED',
      sessionId: session.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: body,
    });
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
}

export async function getActiveSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getActiveSession(req.auth!.sub);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function endSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const facultyId = req.auth!.sub;
    const session = await endSession(sessionId, facultyId);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: facultyId,
      actorType: 'FACULTY',
      action: 'SESSION_ENDED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function getSessionStatsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const stats = await getSessionStats(sessionId);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

export async function getSessionPublicInfoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const info = await getSessionPublicInfo(sessionId);
    res.status(200).json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
}

export async function manualAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const input = manualAttendanceSchema.parse(req.body);
    const result = await applyFacultyOverride(req, sessionId, input);
    res.status(result.created ? 201 : 200).json({
      success: true,
      message: `Attendance marked ${input.status.toLowerCase()} manually.`,
      data: formatOverrideResult(result),
    });
  } catch (err) {
    next(err);
  }
}

export async function correctAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const input = correctionSchema.parse(req.body);
    const result = await applyFacultyOverride(req, sessionId, input);
    res.status(200).json({
      success: true,
      message: `Attendance changed to ${input.status}.`,
      data: formatOverrideResult(result),
    });
  } catch (err) {
    next(err);
  }
}

export async function pauseSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const session = await pauseSession(sessionId, req.auth!.sub);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'SESSION_PAUSED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function resumeSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = sessionParamsSchema.parse(req.params);
    const session = await resumeSession(sessionId, req.auth!.sub);
    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: req.auth!.sub,
      actorType: 'FACULTY',
      action: 'SESSION_RESUMED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

async function applyFacultyOverride(
  req: Request,
  sessionId: string,
  input: z.infer<typeof correctionSchema>
) {
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
  return result;
}

function formatOverrideResult(result: Awaited<ReturnType<typeof overrideAttendance>>) {
  return {
    attendanceId: result.record.id,
    studentId: result.student.id,
    rollNo: result.student.rollNo,
    status: result.record.status,
    method: result.record.method,
    previousStatus: result.previousStatus,
    originalMethod: result.originalMethod,
    updatedAt: result.record.updatedAt.toISOString(),
  };
}
