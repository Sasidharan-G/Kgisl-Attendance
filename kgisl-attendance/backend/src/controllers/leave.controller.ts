import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { applyLeaveRequestToExistingSessions } from '../services/leave.service';
import { facultyBatchIds } from '../services/facultyScope';

const MAX_SPAN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const requestSchema = z.object({
  type: z.enum(['LEAVE', 'ON_DUTY']),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(5).max(500),
})
  .refine((value) => value.fromDate <= value.toDate, { message: 'From date must be before to date' })
  .refine((value) => (value.toDate.getTime() - value.fromDate.getTime()) / DAY_MS <= MAX_SPAN_DAYS, {
    message: `A single request can cover at most ${MAX_SPAN_DAYS} days`,
  });

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().min(3).max(300),
});

export async function createLeaveRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = requestSchema.parse(req.body);
    const existing = await prisma.leaveRequest.findFirst({
      // An approved request for the same dates is as much of a duplicate as a pending one.
      where: { studentId: req.auth!.sub, status: { in: ['PENDING', 'APPROVED'] }, fromDate: { lte: input.toDate }, toDate: { gte: input.fromDate } },
    });
    if (existing) {
      res.status(409).json({
        success: false,
        message: existing.status === 'APPROVED'
          ? 'You already have an approved request covering these dates.'
          : 'An overlapping request is already pending.',
      });
      return;
    }
    const data = await prisma.leaveRequest.create({ data: { studentId: req.auth!.sub, ...input } });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listLeaveRequestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    let where = {};
    if (req.auth!.role === 'STUDENT') where = { studentId: req.auth!.sub };
    if (req.auth!.role === 'FACULTY') {
      where = { student: { batchId: { in: await facultyBatchIds(req.auth!.sub) } } };
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
      const batches = await facultyBatchIds(req.auth!.sub);
      if (!batches.includes(request.student.batchId)) { res.status(403).json({ success: false, message: 'You cannot review this section.' }); return; }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: request.id },
      data: { ...input, reviewedBy: req.auth!.sub, reviewedAt: new Date() },
    });
    if (input.status === 'APPROVED') {
      // If marking the existing sessions fails, put the request back to pending so the reviewer can simply try again
      // instead of leaving it "approved" with nothing excused.
      try {
        await applyLeaveRequestToExistingSessions(
          { studentId: request.studentId, batchId: request.student.batchId, type: request.type, fromDate: request.fromDate, toDate: request.toDate },
          { id: req.auth!.sub, note: input.reviewNote || 'Approved leave request' }
        );
      } catch (error) {
        await prisma.leaveRequest.update({ where: { id: request.id }, data: { status: 'PENDING', reviewNote: null, reviewedBy: null, reviewedAt: null } });
        throw error;
      }
    }
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}
