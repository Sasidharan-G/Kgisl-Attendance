import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rollNo: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  regNo: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6),
  batchId: z.string().uuid(),
});

export async function createStudentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createStudentSchema.parse(req.body);
    const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
    if (!batch) {
      res.status(404).json({ success: false, message: 'Selected section does not exist' });
      return;
    }

    const duplicate = await prisma.student.findFirst({
      where: { OR: [{ rollNo: input.rollNo }, { regNo: input.regNo }, { email: input.email }] },
      select: { rollNo: true, regNo: true, email: true },
    });
    if (duplicate) {
      res.status(409).json({ success: false, message: 'Roll number, register number, or email already exists' });
      return;
    }

    const student = await prisma.student.create({
      data: {
        name: input.name,
        rollNo: input.rollNo,
        regNo: input.regNo,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 10),
        batchId: input.batchId,
      },
      include: { batch: true },
    });

    res.status(201).json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        regNo: student.regNo,
        email: student.email,
        batchId: student.batchId,
        batchName: student.batch.name,
        lastScanTime: null,
        attendancePercentage: 100,
        totalSessions: 0,
        attendedSessions: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { records: true } } },
    });
    if (!student) {
      res.status(404).json({ success: false, message: 'Student does not exist' });
      return;
    }
    if (student._count.records > 0) {
      res.status(409).json({ success: false, message: 'Student has attendance history and cannot be removed' });
      return;
    }
    await prisma.student.delete({ where: { id: student.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listStudentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
    const students = await prisma.student.findMany({
      where: batchId ? { batchId } : undefined,
      include: {
        batch: true,
        records: {
          where: { status: 'PRESENT' },
          orderBy: { scanTime: 'desc' },
        },
      },
      orderBy: { rollNo: 'asc' },
    });

    // Get total ended sessions per batch to calculate attendance percentage
    const endedSessions = await prisma.attendanceSession.findMany({
      select: {
        batchId: true,
      },
    });

    const sessionsCountByBatch = endedSessions.reduce((acc: Record<string, number>, s) => {
      acc[s.batchId] = (acc[s.batchId] || 0) + 1;
      return acc;
    }, {});

    const studentListWithStats = students.map((student) => {
      const totalBatchSessions = sessionsCountByBatch[student.batchId] || 0;
      const attendedSessions = student.records.length;
      const percentage = totalBatchSessions > 0 
        ? Math.round((attendedSessions / totalBatchSessions) * 100) 
        : 100;

      const lastScan = student.records[0];

      return {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        regNo: student.regNo,
        email: student.email,
        batchName: student.batch.name,
        batchId: student.batchId,
        lastScanTime: lastScan ? lastScan.scanTime : null,
        attendancePercentage: percentage,
        totalSessions: totalBatchSessions,
        attendedSessions,
      };
    });

    res.json({ success: true, data: studentListWithStats });
  } catch (err) {
    next(err);
  }
}
