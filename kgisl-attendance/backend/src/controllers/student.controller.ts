import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { revokeAllUserSessions } from '../services/refreshToken.service';
import {
  COMPLETED_SESSION_STATUSES,
  LIVE_SESSION_STATUSES,
  PRESENT_STATUSES,
  SHORTAGE_RATIO,
  isPresentStatus,
} from '../utils/attendanceStatus';

const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rollNo: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  regNo: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  // Only an initial password: the student must replace it at the first sign-in.
  password: z.string().min(6),
  batchId: z.string().uuid(),
});
const bulkStudentSchema = z.object({
  batchId: z.string().uuid(),
  students: z.array(createStudentSchema.omit({ batchId: true })).min(1).max(500),
});

type MentorBatchAccess =
  | { batch: { id: string; name: string; mentorId: string | null; lifecycle: 'ACTIVE' | 'ARCHIVE_PENDING' | 'ARCHIVED' } }
  | { error: string; status: number };

async function requireMentorBatch(req: Request, batchId: string): Promise<MentorBatchAccess> {
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, select: { id: true, name: true, mentorId: true, lifecycle: true } });
  if (!batch) return { error: 'Selected section does not exist', status: 404 } as const;
  if (batch.lifecycle !== 'ACTIVE') return { error: 'Students can only be managed in an active batch', status: 409 } as const;
  if (req.auth!.role === 'FACULTY' && batch.mentorId !== req.auth!.sub) return { error: 'Only the assigned section mentor can manage these students', status: 403 } as const;
  return { batch } as const;
}

export async function createStudentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createStudentSchema.parse(req.body);
    const access = await requireMentorBatch(req, input.batchId);
    if ('error' in access) { res.status(access.status).json({ success: false, message: access.error }); return; }
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
        mustChangePassword: true,
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

/** Imports a validated, user-reviewed CSV payload.  The API deliberately
 * rejects the whole file when any identity collides, avoiding partial batches. */
export async function bulkCreateStudentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = bulkStudentSchema.parse(req.body);
    const access = await requireMentorBatch(req, input.batchId);
    if ('error' in access) { res.status(access.status).json({ success: false, message: access.error }); return; }
    const batch = access.batch;
    const seen = new Set<string>();
    for (const student of input.students) {
      for (const value of [student.rollNo, student.regNo, student.email]) {
        const key = value.toLowerCase();
        if (seen.has(key)) { res.status(400).json({ success: false, message: `Duplicate value in import: ${value}` }); return; }
        seen.add(key);
      }
    }
    const identityValues = input.students.flatMap((s) => [s.rollNo, s.regNo, s.email]);
    const existing = await prisma.student.findFirst({ where: { OR: [{ rollNo: { in: identityValues } }, { regNo: { in: identityValues } }, { email: { in: identityValues.map((v) => v.toLowerCase()) } }] }, select: { rollNo: true } });
    if (existing) { res.status(409).json({ success: false, message: `Import stopped: ${existing.rollNo} or another identity already exists` }); return; }
    const passwordHashes = await Promise.all(input.students.map((student) => bcrypt.hash(student.password, 10)));
    await prisma.student.createMany({ data: input.students.map((student, index) => ({ ...student, email: student.email.toLowerCase(), batchId: batch.id, passwordHash: passwordHashes[index], mustChangePassword: true })) });
    res.status(201).json({ success: true, data: { created: input.students.length, batchName: batch.name } });
  } catch (err) { next(err); }
}

export async function setStudentStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const existing = await prisma.student.findUnique({ where: { id: req.params.id }, select: { batchId: true } });
    if (!existing) { res.status(404).json({ success: false, message: 'Student does not exist' }); return; }
    const access = await requireMentorBatch(req, existing.batchId); if ('error' in access) { res.status(access.status).json({ success: false, message: access.error }); return; }
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, isActive: true },
    });
    // A deactivated student must not keep marking attendance on a still-valid refresh token.
    if (!isActive) await revokeAllUserSessions(student.id, 'STUDENT');
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

/** Clears a lost/replaced phone binding. The next successful in-class scan
 * securely binds the student's new device; the reset itself is audit logged. */
export async function resetStudentDeviceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.student.findUnique({ where: { id: req.params.id }, select: { batchId: true } });
    if (!existing) { res.status(404).json({ success: false, message: 'Student does not exist' }); return; }
    const access = await requireMentorBatch(req, existing.batchId); if ('error' in access) { res.status(access.status).json({ success: false, message: access.error }); return; }
    // Clearing the binding also revokes any Face ID / Touch ID passkey so the student can re-enrol on a new device.
    const [, student] = await prisma.$transaction([
      prisma.studentPasskey.deleteMany({ where: { studentId: req.params.id } }),
      prisma.student.update({ where: { id: req.params.id }, data: { deviceId: null }, select: { id: true, name: true, rollNo: true } }),
    ]);
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: req.auth!.role as 'ADMIN' | 'FACULTY', action: 'STUDENT_DEVICE_RESET', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { studentId: student.id, rollNo: student.rollNo } });
    res.json({ success: true, data: student, message: `Device reset for ${student.name}. The next verified scan will bind the new phone.` });
  } catch (err) { next(err); }
}

export async function listStudentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
    const archived = req.auth!.role === 'ADMIN' && req.query.view === 'archived';
    const students = await prisma.student.findMany({
      relationLoadStrategy: 'join',
      where: {
        archivedAt: archived ? { not: null } : null,
        ...(batchId ? { batchId } : {}),
        ...(req.auth!.role === 'FACULTY' ? { batch: { mentorId: req.auth!.sub, lifecycle: { not: 'ARCHIVED' } } } : {}),
      },
      select: {
        id: true, name: true, rollNo: true, regNo: true, email: true, isActive: true, archivedAt: true, batchId: true,
        batch: { select: { name: true } },
      },
      orderBy: { rollNo: 'asc' },
    });

    const batchIds = [...new Set(students.map((student) => student.batchId))];
    const studentIds = students.map((student) => student.id);

    // Percentages use finished classes only, exactly like the student dashboard and the reports. The old query counted
    // every session of the batch (including the one still running), so a student's % dropped the moment a class started.
    const [sessionTotals, attended, lastScans] = await Promise.all([
      prisma.attendanceSession.groupBy({
        by: ['batchId'],
        where: { batchId: { in: batchIds }, status: { in: COMPLETED_SESSION_STATUSES } },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: { in: PRESENT_STATUSES }, session: { status: { in: COMPLETED_SESSION_STATUSES } } },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: { in: PRESENT_STATUSES } },
        _max: { scanTime: true },
      }),
    ]);

    const totalByBatch = new Map(sessionTotals.map((row) => [row.batchId, row._count._all]));
    const attendedByStudent = new Map(attended.map((row) => [row.studentId, row._count._all]));
    const lastScanByStudent = new Map(lastScans.map((row) => [row.studentId, row._max.scanTime]));

    const studentListWithStats = students.map((student) => {
      const totalBatchSessions = totalByBatch.get(student.batchId) ?? 0;
      const attendedSessions = attendedByStudent.get(student.id) ?? 0;
      const percentage = totalBatchSessions > 0
        ? Math.min(100, Math.round((attendedSessions / totalBatchSessions) * 100))
        : 100;

      return {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        regNo: student.regNo,
        email: student.email,
        isActive: student.isActive,
        archivedAt: student.archivedAt,
        batchName: student.batch.name,
        batchId: student.batchId,
        lastScanTime: lastScanByStudent.get(student.id) ?? null,
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
      // EXPIRED (auto-ended) classes are real classes too; leaving them out hid whole days from the student.
      where: { batchId: student.batchId, status: { in: [...COMPLETED_SESSION_STATUSES, ...LIVE_SESSION_STATUSES] } },
      include: { subject: true, faculty: { select: { name: true } }, records: { where: { studentId: student.id }, select: { scanTime: true, status: true, method: true, overrideReason: true } } },
      orderBy: { startedAt: 'desc' },
    });

    // Only finished classes count towards percentages; a class that is still running is shown in the list
    // but is not yet "absent" for anyone.
    const grouped = new Map<string, { code: string; name: string; total: number; present: number }>();
    for (const session of sessions) {
      if (!COMPLETED_SESSION_STATUSES.includes(session.status)) continue;
      const current = grouped.get(session.subjectId) || { code: session.subject.code, name: session.subject.name, total: 0, present: 0 };
      current.total += 1;
      if (session.records.some((record) => isPresentStatus(record.status))) current.present += 1;
      grouped.set(session.subjectId, current);
    }
    const subjects = [...grouped.values()].map((item) => ({
      ...item,
      absent: item.total - item.present,
      percentage: item.total ? Math.round((item.present / item.total) * 100) : 100,
      shortage: item.total > 0 && item.present / item.total < SHORTAGE_RATIO,
    }));

    res.json({
      success: true,
      data: {
        student: { name: student.name, rollNo: student.rollNo, regNo: student.regNo, batchName: student.batch.name },
        subjects,
        sessions: sessions.map((session) => ({
          sessionId: session.sessionId,
          subjectCode: session.subject.code,
          subjectName: session.subject.name,
          facultyName: session.faculty.name,
          startedAt: session.startedAt,
          status: session.records[0]?.status ?? 'ABSENT',
          method: session.records[0]?.method ?? null,
          overrideReason: session.records[0]?.overrideReason ?? null,
          scanTime: session.records[0]?.scanTime ?? null,
          sessionStatus: session.status,
          inProgress: LIVE_SESSION_STATUSES.includes(session.status),
        })),
      },
    });
  } catch (err) { next(err); }
}
