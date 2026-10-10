import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { overrideAttendance } from '../services/attendance.service';
import { Errors } from '../utils/AppError';
import { LIVE_SESSION_STATUSES, isPresentStatus } from '../utils/attendanceStatus';

const createSchema = z.object({ sessionId: z.string().uuid(), reason: z.string().trim().min(8).max(500) });
const reviewSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']), reviewNote: z.string().trim().min(3).max(300) });

export async function createCorrectionHandler(req: Request, res: Response, next: NextFunction) { try {
  const input = createSchema.parse(req.body);
  const studentId = req.auth!.sub;
  const session = await prisma.attendanceSession.findFirst({
    where: { sessionId: input.sessionId, batch: { students: { some: { id: studentId } } } },
    select: { sessionId: true, status: true },
  });
  if (!session) { res.status(404).json({ success: false, message: 'Attendance session was not found for your section.' }); return; }
  // A class that is still running can still be marked normally; a correction only makes sense afterwards.
  if (LIVE_SESSION_STATUSES.includes(session.status)) throw Errors.SESSION_STILL_LIVE();

  const record = await prisma.attendanceRecord.findUnique({
    where: { uq_student_session: { studentId, sessionId: session.sessionId } },
    select: { status: true },
  });
  if (record && isPresentStatus(record.status)) throw Errors.ALREADY_PRESENT();

  // One request per student per session (database rule). A rejected request may be re-submitted with a better
  // explanation; anything else is a duplicate and gets a clear message instead of a server error.
  const previous = await prisma.attendanceCorrectionRequest.findUnique({
    where: { studentId_sessionId: { studentId, sessionId: session.sessionId } },
  });
  if (previous && previous.status !== 'REJECTED') throw Errors.DUPLICATE_REQUEST();
  const data = previous
    ? await prisma.attendanceCorrectionRequest.update({
        where: { id: previous.id },
        data: { reason: input.reason, status: 'PENDING', reviewNote: null, reviewedBy: null, reviewedAt: null },
      })
    : await prisma.attendanceCorrectionRequest.create({ data: { studentId, ...input } });
  res.status(201).json({ success: true, data });
} catch (err) { next(err); } }

export async function listCorrectionsHandler(req: Request, res: Response, next: NextFunction) { try {
  const where = req.auth!.role === 'STUDENT' ? { studentId: req.auth!.sub } : req.auth!.role === 'FACULTY' ? { session: { facultyId: req.auth!.sub } } : {};
  const data = await prisma.attendanceCorrectionRequest.findMany({ where, include: { student: { select: { name: true, rollNo: true } }, session: { include: { subject: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data });
} catch (err) { next(err); } }

export async function reviewCorrectionHandler(req: Request, res: Response, next: NextFunction) { try {
  const input = reviewSchema.parse(req.body);
  const request = await prisma.attendanceCorrectionRequest.findUnique({ where: { id: req.params.id }, include: { student: true, session: true } });
  if (!request) { res.status(404).json({ success: false, message: 'Correction request not found.' }); return; }
  if (request.status !== 'PENDING') { res.status(409).json({ success: false, message: 'This request has already been reviewed.' }); return; }
  if (req.auth!.role === 'FACULTY' && request.session.facultyId !== req.auth!.sub) { res.status(403).json({ success: false, message: 'Only the session faculty can review this request.' }); return; }
  if (input.status === 'APPROVED') {
    await overrideAttendance({
      sessionId: request.sessionId,
      facultyId: req.auth!.sub,
      actorRole: req.auth!.role === 'ADMIN' ? 'ADMIN' : 'FACULTY',
      rollNo: request.student.rollNo,
      status: 'PRESENT',
      reason: `Correction approved: ${input.reviewNote}`,
    });
  }
  const data = await prisma.attendanceCorrectionRequest.update({ where: { id: request.id }, data: { ...input, reviewedBy: req.auth!.sub, reviewedAt: new Date() } });
  res.json({ success: true, data });
} catch (err) { next(err); } }
