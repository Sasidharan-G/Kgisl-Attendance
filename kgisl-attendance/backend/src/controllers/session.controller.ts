import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { startSession, endSession, getSessionStats, getSessionPublicInfo, getActiveSession } from '../services/session.service';
import { writeAuditLog, requestContext } from '../services/audit.service';

const startSchema = z.object({
  allocationId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roomId: z.string().uuid(),
  batchId: z.string().uuid(),
});

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

export async function getActiveSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getActiveSession(req.auth!.sub);
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
}

export async function endSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;
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
    const { sessionId } = req.params;
    const stats = await getSessionStats(sessionId);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

/**
 * Deliberately minimal, non-sensitive lookup: tells a scanning student's app
 * which batch/subject a sessionId (decoded from the QR) belongs to, so the
 * client can send batchIdClaimed/subjectIdClaimed alongside the QR token.
 * This is safe to expose because the QR itself never carries attendance
 * data (per spec) — the sessionId alone grants no ability to mark attendance
 * without also passing every other check in the validation pipeline.
 */
export async function getSessionPublicInfoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;
    const info = await getSessionPublicInfo(sessionId);
    res.status(200).json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
}

import { markManualAttendance } from '../services/attendance.service';
import { broadcastAttendanceMarked } from '../websocket/socket';
import { prisma } from '../config/prisma';

const manualAttendanceSchema = z.object({
  rollNo: z.string().min(1),
});

export async function manualAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;
    const { rollNo } = manualAttendanceSchema.parse(req.body);
    const facultyId = req.auth!.sub;

    const { record, student } = await markManualAttendance({ sessionId, rollNo, facultyId });

    broadcastAttendanceMarked(sessionId, {
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.rollNo,
      scanTime: record.scanTime.toISOString(),
    });

    const ctx = requestContext(req);
    await writeAuditLog({
      actorId: facultyId,
      actorType: 'FACULTY',
      action: 'MANUAL_ATTENDANCE_MARKED',
      sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { rollNo },
    });

    res.status(201).json({ success: true, message: 'Attendance marked manually' });
  } catch (err) {
    next(err);
  }
}

const correctionSchema = z.object({ rollNo: z.string().min(1), status: z.enum(['PRESENT', 'ABSENT']), reason: z.string().trim().min(3).max(200) });

export async function correctAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;
    const input = correctionSchema.parse(req.body);
    const session = await prisma.attendanceSession.findFirst({ where: { sessionId, facultyId: req.auth!.sub } });
    if (!session) { res.status(404).json({ success: false, message: 'Session not found' }); return; }
    const student = await prisma.student.findFirst({ where: { rollNo: input.rollNo, batchId: session.batchId } });
    if (!student) { res.status(404).json({ success: false, message: 'Student is not enrolled in this section' }); return; }
    if (input.status === 'ABSENT') {
      await prisma.attendanceRecord.deleteMany({ where: { sessionId, studentId: student.id, status: 'PRESENT' } });
    } else {
      const existing = await prisma.attendanceRecord.findFirst({ where: { sessionId, studentId: student.id, status: 'PRESENT' } });
      if (!existing) await markManualAttendance({ sessionId, rollNo: student.rollNo, facultyId: req.auth!.sub });
    }
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: 'FACULTY', action: 'ATTENDANCE_CORRECTED', sessionId, ip: ctx.ip, userAgent: ctx.userAgent, metadata: { rollNo: student.rollNo, status: input.status, reason: input.reason } });
    res.json({ success: true, message: `Attendance changed to ${input.status}` });
  } catch (err) { next(err); }
}
