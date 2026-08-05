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
        isActive: student.isActive,
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
      select: { id: true },
    });
    if (!student) {
      res.status(404).json({ success: false, message: 'Student does not exist' });
      return;
    }
    await prisma.student.update({ where: { id: student.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Student account deactivated; attendance history was preserved.' });
  } catch (err) {
    next(err);
  }
}

export async function setStudentStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, isActive: true },
    });
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

export async function listStudentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
    const students = await prisma.student.findMany({
      where: batchId ? { batchId } : undefined,
      include: {
        batch: true,
        records: {
          where: { status: { in: ['PRESENT', 'LATE', 'ON_DUTY'] } },
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
        isActive: student.isActive,
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

export async function getMyAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.auth!.sub }, include: { batch: true } });
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    const sessions = await prisma.attendanceSession.findMany({
      where: { batchId: student.batchId, status: { in: ['ENDED', 'ACTIVE'] } },
      include: { subject: true, faculty: { select: { name: true } }, records: { where: { studentId: student.id }, select: { scanTime: true, status: true, method: true, overrideReason: true } } },
      orderBy: { startedAt: 'desc' },
    });
    const grouped = new Map<string, { code: string; name: string; total: number; present: number }>();
    for (const session of sessions) { const current = grouped.get(session.subjectId) || { code: session.subject.code, name: session.subject.name, total: 0, present: 0 }; current.total += 1; if (session.records.some((record) => ['PRESENT', 'LATE', 'ON_DUTY'].includes(record.status))) current.present += 1; grouped.set(session.subjectId, current); }
    const subjects = [...grouped.values()].map((item) => ({ ...item, absent: item.total - item.present, percentage: item.total ? Math.round(item.present / item.total * 100) : 100, shortage: item.total > 0 && item.present / item.total < 0.75 }));
    res.json({ success: true, data: { student: { name: student.name, rollNo: student.rollNo, regNo: student.regNo, batchName: student.batch.name }, subjects, sessions: sessions.map((session) => ({ sessionId: session.sessionId, subjectCode: session.subject.code, subjectName: session.subject.name, facultyName: session.faculty.name, startedAt: session.startedAt, status: session.records[0]?.status ?? 'ABSENT', method: session.records[0]?.method ?? null, overrideReason: session.records[0]?.overrideReason ?? null, scanTime: session.records[0]?.scanTime ?? null })) } });
  } catch (err) { next(err); }
}
