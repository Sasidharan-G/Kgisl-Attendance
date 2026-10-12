import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

// Real clock times only: "99:99" used to pass and would later break every start-session time check.
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:10');

const allocationSchema = z.object({
  facultyId: z.string().uuid(), subjectId: z.string().uuid(), batchId: z.string().uuid(), roomId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7), startTime: clockTime, endTime: clockTime,
}).refine((v) => v.startTime < v.endTime, { message: 'End time must be after start time' });

const include = { faculty: { select: { id: true, name: true } }, subject: true, batch: true, room: true } as const;
// One SQL statement with joins instead of one query per relation (the database is a network hop away).
const join = { relationLoadStrategy: 'join' } as const;

export async function listAllocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    let where = {};
    if (req.auth!.role === 'STUDENT') {
      // Students see their own section's timetable (this feeds "Today's class schedule" on their dashboard).
      const student = await prisma.student.findUnique({ where: { id: req.auth!.sub }, select: { batchId: true } });
      where = { batchId: student?.batchId ?? '' };
    }
    if (req.auth!.role === 'FACULTY') {
      if (req.query.scope === 'section') {
        const ownAllocations = await prisma.timetableAllocation.findMany({
          where: { facultyId: req.auth!.sub },
          select: { batchId: true },
          distinct: ['batchId'],
        });
        where = { batchId: { in: ownAllocations.map((item) => item.batchId) } };
      } else {
        where = { facultyId: req.auth!.sub };
      }
    }
    const data = await prisma.timetableAllocation.findMany({ ...join, where, include, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createAllocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = allocationSchema.parse(req.body);
    const [faculty, batch, conflict] = await Promise.all([
      prisma.faculty.findUnique({ where: { id: body.facultyId }, select: { isActive: true } }),
      prisma.batch.findUnique({ where: { id: body.batchId }, select: { lifecycle: true } }),
      prisma.timetableAllocation.findFirst({
        ...join,
        where: {
          dayOfWeek: body.dayOfWeek,
          startTime: { lt: body.endTime },
          endTime: { gt: body.startTime },
          OR: [{ facultyId: body.facultyId }, { batchId: body.batchId }, { roomId: body.roomId }],
        },
        include,
      }),
    ]);
    if (!faculty?.isActive) {
      res.status(409).json({ success: false, code: 'FACULTY_UNAVAILABLE', message: 'The selected faculty account is inactive or does not exist.' });
      return;
    }
    if (batch?.lifecycle !== 'ACTIVE') {
      res.status(409).json({ success: false, code: 'BATCH_NOT_ACTIVE', message: 'Classes can only be assigned to an active section.' });
      return;
    }
    if (conflict) {
      const resource = conflict.facultyId === body.facultyId
        ? `faculty ${conflict.faculty.name}`
        : conflict.batchId === body.batchId
          ? `section ${conflict.batch.name}`
          : `room ${conflict.room.name}`;
      res.status(409).json({
        success: false,
        code: 'TIMETABLE_CONFLICT',
        message: `Timetable conflict: ${resource} is already allocated from ${conflict.startTime} to ${conflict.endTime}.`,
      });
      return;
    }
    const data = await prisma.timetableAllocation.create({ ...join, data: body, include });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteAllocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.timetableAllocation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
}
