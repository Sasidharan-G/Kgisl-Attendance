import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

const requestSchema = z.object({
  type: z.enum(['LEAVE', 'ON_DUTY']),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(5).max(500),
}).refine((value) => value.fromDate <= value.toDate, { message: 'From date must be before to date' });

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().min(3).max(300),
});

export async function createLeaveRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = requestSchema.parse(req.body);
    const existing = await prisma.leaveRequest.findFirst({
      where: { studentId: req.auth!.sub, status: 'PENDING', fromDate: { lte: input.toDate }, toDate: { gte: input.fromDate } },
    });
    if (existing) { res.status(409).json({ success: false, message: 'An overlapping request is already pending.' }); return; }
    const data = await prisma.leaveRequest.create({ data: { studentId: req.auth!.sub, ...input } });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listLeaveRequestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    let where = {};
    if (req.auth!.role === 'STUDENT') where = { studentId: req.auth!.sub };
    if (req.auth!.role === 'FACULTY') {
      const batches = await prisma.timetableAllocation.findMany({ where: { facultyId: req.auth!.sub }, select: { batchId: true }, distinct: ['batchId'] });
      where = { student: { batchId: { in: batches.map((item) => item.batchId) } } };
    }
    const data = await prisma.leaveRequest.findMany({ where, include: { student: { select: { name: true, rollNo: true, regNo: true, batch: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function reviewLeaveRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = reviewSchema.parse(req.body);
    const request = await prisma.leaveRequest.findUnique({ where: { id: req.params.id }, include: { student: true } });
    if (!request) { res.status(404).json({ success: false, message: 'Request not found' }); return; }
    if (request.status !== 'PENDING') { res.status(409).json({ success: false, message: 'Request was already reviewed' }); return; }
    if (req.auth!.role === 'FACULTY') {
      const ownsBatch = await prisma.timetableAllocation.findFirst({ where: { facultyId: req.auth!.sub, batchId: request.student.batchId } });
      if (!ownsBatch) { res.status(403).json({ success: false, message: 'You cannot review this section.' }); return; }
    }

    const updated = await prisma.leaveRequest.update({ where: { id: request.id }, data: { ...input, reviewedBy: req.auth!.sub, reviewedAt: new Date() } });
    if (input.status === 'APPROVED') {
      const end = new Date(request.toDate); end.setHours(23, 59, 59, 999);
      const sessions = await prisma.attendanceSession.findMany({ where: { batchId: request.student.batchId, startedAt: { gte: request.fromDate, lte: end } }, select: { sessionId: true } });
      const attendanceStatus = request.type === 'ON_DUTY' ? 'ON_DUTY' : 'LEAVE';
      for (const session of sessions) {
        await prisma.attendanceRecord.upsert({
          where: { uq_student_session: { studentId: request.studentId, sessionId: session.sessionId } },
          update: { status: attendanceStatus },
          create: { studentId: request.studentId, sessionId: session.sessionId, status: attendanceStatus, gpsLat: 0, gpsLng: 0, deviceId: 'APPROVED_REQUEST', locationVerificationStatus: 'APPROVED_REQUEST' },
        });
      }
    }
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}
