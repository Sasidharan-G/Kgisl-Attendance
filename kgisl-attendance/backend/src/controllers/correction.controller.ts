import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { overrideAttendance } from '../services/attendance.service';
import { createNotification } from '../services/notification.service';

const createSchema = z.object({ sessionId: z.string().uuid(), reason: z.string().trim().min(8).max(500) });
const reviewSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']), reviewNote: z.string().trim().min(3).max(300) });

export async function createCorrectionHandler(req: Request, res: Response, next: NextFunction) { try {
  const input = createSchema.parse(req.body);
  const session = await prisma.attendanceSession.findFirst({ where: { sessionId: input.sessionId, batch: { students: { some: { id: req.auth!.sub } } } }, select: { sessionId: true } });
  if (!session) { res.status(404).json({ success: false, message: 'Attendance session was not found for your section.' }); return; }
  const data = await prisma.attendanceCorrectionRequest.create({ data: { studentId: req.auth!.sub, ...input } });
  const details = await prisma.attendanceSession.findUnique({ where: { sessionId: input.sessionId }, select: { facultyId: true, subject: { select: { code: true } } } });
  if (details) await createNotification({ recipientId: details.facultyId, recipientRole: 'FACULTY', type: 'CORRECTION_REQUESTED', title: 'Attendance correction requested', message: `A student requested a correction for ${details.subject.code}.`, href: '/faculty/corrections' });
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
  if (input.status === 'APPROVED') await overrideAttendance({ sessionId: request.sessionId, facultyId: req.auth!.sub, rollNo: request.student.rollNo, status: 'PRESENT', reason: `Correction approved: ${input.reviewNote}` });
  const data = await prisma.attendanceCorrectionRequest.update({ where: { id: request.id }, data: { ...input, reviewedBy: req.auth!.sub, reviewedAt: new Date() } });
  await createNotification({ recipientId: request.studentId, recipientRole: 'STUDENT', type: 'CORRECTION_REVIEWED', title: `Attendance correction ${input.status.toLowerCase()}`, message: `Your correction request has been ${input.status.toLowerCase()}.`, href: '/student/attendance' });
  res.json({ success: true, data });
} catch (err) { next(err); } }
