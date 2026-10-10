import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Errors } from '../utils/AppError';
import { COMPLETED_SESSION_STATUSES, PRESENT_STATUSES, SHORTAGE_RATIO, isPresentStatus } from '../utils/attendanceStatus';
import { istDayWindow } from '../utils/time';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `dateFrom` / `dateTo` query value. A plain "YYYY-MM-DD" means that whole IST calendar day (classes run on
 * Indian time while the server runs on UTC), anything else is treated as an exact instant.
 */
export function parseDateFilter(value: unknown, edge: 'start' | 'end'): Date | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  if (DATE_ONLY.test(value)) {
    const day = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime())) throw Errors.INVALID_DATE();
    const window = istDayWindow(day);
    return edge === 'start' ? window.start : window.end;
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw Errors.INVALID_DATE();
  return instant;
}

type RosterStudent = { isActive: boolean; archivedAt: Date | null };

/**
 * Students expected in a session: everyone currently enrolled and active, plus anyone who has since been
 * deactivated but still has a record for that session (so historic numbers stay consistent).
 */
function expectedStudents(activeCount: number, records: Array<{ student: RosterStudent }>): number {
  const retired = records.filter((record) => !record.student.isActive || record.student.archivedAt !== null).length;
  return activeCount + retired;
}

const activeRoster = { where: { isActive: true, archivedAt: null } } as const;

export async function listSessionHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFrom = parseDateFilter(req.query.dateFrom, 'start');
    const dateTo = parseDateFilter(req.query.dateTo, 'end');
    const filters = {
      ...(typeof req.query.batchId === 'string' && { batchId: req.query.batchId }),
      ...(typeof req.query.subjectId === 'string' && { subjectId: req.query.subjectId }),
      ...(typeof req.query.facultyId === 'string' && req.auth!.role === 'ADMIN' && { facultyId: req.query.facultyId }),
      ...((dateFrom || dateTo) && { startedAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }),
    };
    const sessions = await prisma.attendanceSession.findMany({
      where: req.auth!.role === 'ADMIN' ? filters : { ...filters, facultyId: req.auth!.sub },
      include: {
        faculty: { select: { name: true, email: true } },
        subject: { select: { name: true, code: true } },
        room: { select: { name: true } },
        batch: { include: { _count: { select: { students: activeRoster } } } },
        records: { select: { status: true, method: true, student: { select: { isActive: true, archivedAt: true } } } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const history = sessions.map((session) => {
      const totalStudents = expectedStudents(session.batch._count.students, session.records);
      const statusCounts = session.records.reduce<Record<string, number>>((counts, record) => {
        counts[record.status] = (counts[record.status] || 0) + 1;
        return counts;
      }, {});
      const methodCounts = session.records.reduce<Record<string, number>>((counts, record) => {
        counts[record.method] = (counts[record.method] || 0) + 1;
        return counts;
      }, {});
      const present = session.records.filter((record) => isPresentStatus(record.status)).length;
      const absent = Math.max(0, totalStudents - present - (statusCounts.LEAVE || 0));

      return {
        sessionId: session.sessionId,
        batchId: session.batchId,
        facultyName: session.faculty.name,
        subjectName: session.subject.name,
        subjectCode: session.subject.code,
        roomName: session.room.name,
        batchName: session.batch.name,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        present,
        absent,
        totalStudents,
        statusCounts,
        methodCounts,
        attendancePercentage: totalStudents ? Math.round((present / totalStudents) * 10000) / 100 : 0,
        sessionType: session.sessionType,
      };
    });

    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}

export async function getSessionAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await prisma.attendanceSession.findFirst({
      where: req.auth!.role === 'ADMIN' ? { sessionId: req.params.sessionId } : { sessionId: req.params.sessionId, facultyId: req.auth!.sub },
      include: {
        faculty: { select: { name: true, email: true } },
        subject: { select: { name: true, code: true } },
        room: { select: { name: true } },
        batch: {
          include: {
            students: {
              select: { id: true, name: true, rollNo: true, regNo: true, email: true, isActive: true, archivedAt: true },
              orderBy: { rollNo: 'asc' },
            },
          },
        },
        records: {
          select: {
            studentId: true,
            status: true,
            scanTime: true,
            locationVerified: true,
            distanceFromCampus: true,
            method: true,
            markedByFacultyId: true,
            overrideReason: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Attendance session not found' });
      return;
    }

    const records = new Map(session.records.map((record) => [record.studentId, record]));
    // Deactivated / passed-out students disappear from the roster unless they actually have a record in this class.
    const students = session.batch.students
      .filter((student) => (student.isActive && student.archivedAt === null) || records.has(student.id))
      .map((student) => {
        const record = records.get(student.id);
        return {
          name: student.name,
          rollNo: student.rollNo,
          regNo: student.regNo,
          email: student.email,
          attendanceStatus: record?.status ?? 'ABSENT',
          scanTime: record?.scanTime ?? null,
          locationVerified: record?.locationVerified ?? false,
          distanceFromCampus: record?.distanceFromCampus ?? null,
          attendanceMethod: record?.method ?? null,
          markedByFacultyId: record?.markedByFacultyId ?? null,
          overrideReason: record?.overrideReason ?? null,
          updatedAt: record?.updatedAt ?? null,
        };
      });

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        date: session.startedAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        status: session.status,
        facultyName: session.faculty.name,
        subjectName: session.subject.name,
        subjectCode: session.subject.code,
        batchName: session.batch.name,
        roomName: session.room.name,
        students,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function analyticsSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Finished classes only: a class that is still running has not produced its attendance yet.
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        status: { in: COMPLETED_SESSION_STATUSES },
        ...(req.auth!.role === 'ADMIN' ? {} : { facultyId: req.auth!.sub }),
      },
      include: {
        batch: { include: { _count: { select: { students: activeRoster } } } },
        records: { select: { status: true, student: { select: { isActive: true, archivedAt: true } } } },
      },
    });
    const statusCounts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, ON_DUTY: 0, LEAVE: 0 };
    let expected = 0;
    for (const session of sessions) {
      expected += expectedStudents(session.batch._count.students, session.records);
      for (const record of session.records) statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
    }
    const recorded = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    statusCounts.ABSENT += Math.max(0, expected - recorded);
    const eligiblePresent = statusCounts.PRESENT + statusCounts.LATE + statusCounts.ON_DUTY;
    res.json({ success: true, data: { sessions: sessions.length, expected, statusCounts, attendancePercentage: expected ? Math.round((eligiblePresent / expected) * 10000) / 100 : 0 } });
  } catch (err) { next(err); }
}

export async function listAuditLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionIds = req.auth!.role === 'FACULTY'
      ? (await prisma.attendanceSession.findMany({ where: { facultyId: req.auth!.sub }, select: { sessionId: true } })).map((item) => item.sessionId)
      : [];
    const where = req.auth!.role === 'ADMIN' ? {} : { OR: [{ actorId: req.auth!.sub }, { sessionId: { in: sessionIds } }] };
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
}

const reportQuerySchema = z.object({
  batchId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
}).strict();

/**
 * Cumulative attendance per student for one section (optionally one subject). A session counts once
 * it has started and is no longer running; PRESENT / LATE / ON_DUTY count as attended, matching the
 * student dashboard. Faculty only see their own sessions; admins see all.
 */
export async function attendanceReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId, subjectId } = reportQuerySchema.parse(req.query);
    const sessionWhere = {
      batchId,
      ...(subjectId ? { subjectId } : {}),
      status: { in: COMPLETED_SESSION_STATUSES },
      ...(req.auth!.role === 'ADMIN' ? {} : { facultyId: req.auth!.sub }),
    };
    const [batch, subject, sessions, students] = await Promise.all([
      prisma.batch.findUnique({ where: { id: batchId }, select: { name: true } }),
      subjectId ? prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true, code: true } }) : Promise.resolve(null),
      prisma.attendanceSession.findMany({ where: sessionWhere, select: { sessionId: true } }),
      prisma.student.findMany({ where: { batchId, isActive: true }, select: { id: true, name: true, rollNo: true, regNo: true }, orderBy: { rollNo: 'asc' } }),
    ]);
    if (!batch) { res.status(404).json({ success: false, message: 'Section not found' }); return; }

    const sessionIds = sessions.map((item) => item.sessionId);
    const attended = sessionIds.length === 0 ? [] : await prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: { sessionId: { in: sessionIds }, status: { in: PRESENT_STATUSES } },
      _count: { _all: true },
    });
    const attendedByStudent = new Map(attended.map((row) => [row.studentId, row._count._all]));
    const total = sessionIds.length;
    const rows = students.map((student) => {
      const count = attendedByStudent.get(student.id) ?? 0;
      const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 100;
      return { rollNo: student.rollNo, regNo: student.regNo, name: student.name, total, attended: count, percentage, shortage: total > 0 && count / total < SHORTAGE_RATIO };
    });

    res.json({
      success: true,
      data: {
        batchName: batch.name,
        subjectName: subject?.name ?? null,
        subjectCode: subject?.code ?? null,
        totalSessions: total,
        students: rows,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
}
