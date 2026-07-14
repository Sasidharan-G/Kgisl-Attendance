import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

const allocationSchema = z.object({
  facultyId: z.string().uuid(), subjectId: z.string().uuid(), batchId: z.string().uuid(), roomId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((v) => v.startTime < v.endTime, { message: 'End time must be after start time' });

const include = { faculty: { select: { id: true, name: true } }, subject: true, batch: true, room: true } as const;

export async function listAllocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    let where = {};
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
    const data = await prisma.timetableAllocation.findMany({ where, include, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createAllocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = allocationSchema.parse(req.body);
    const conflict = await prisma.timetableAllocation.findFirst({
      where: {
        dayOfWeek: body.dayOfWeek,
        startTime: { lt: body.endTime },
        endTime: { gt: body.startTime },
        OR: [
          { facultyId: body.facultyId },
          { batchId: body.batchId },
          { roomId: body.roomId },
        ],
      },
      include,
    });
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
    const data = await prisma.timetableAllocation.create({ data: body, include });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteAllocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.timetableAllocation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
}
