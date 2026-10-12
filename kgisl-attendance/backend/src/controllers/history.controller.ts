import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { Errors } from '../utils/AppError';
import { COMPLETED_SESSION_STATUSES, PRESENT_STATUSES, SHORTAGE_RATIO, isPresentStatus } from '../utils/attendanceStatus';
import { istDayWindow } from '../utils/time';
import { facultyBatchIds } from '../services/facultyScope';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

const activeRoster = { where: { isActive: true, archivedAt: null } } as const;

/**
 * Students expected in a session: everyone currently enrolled and active, plus anyone who has since been
 * deactivated but still has a record for that session (so historic numbers stay consistent).
 */
function expectedStudents(activeCount: number, records: Array<{ student: { isActive: boolean; archivedAt: Date | null } }>): number {
  const retired = records.filter((record) => !record.student.isActive || record.student.archivedAt !== null).length;
  return activeCount + retired;
}

const historyQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function listSessionHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId, subjectId, facultyId, limit } = historyQuerySchema.parse(req.query);
    const dateFrom = parseDateFilter(req.query.dateFrom, 'start');
    const dateTo = parseDateFilter(req.query.dateTo, 'end');
    const isAdmin = req.auth!.role === 'ADMIN';
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        ...(batchId && { batchId }),
        ...(subjectId && { subjectId }),
        // Faculty only ever see their own classes; an administrator may narrow the list to one faculty member.
        ...(isAdmin ? (facultyId ? { facultyId } : {}) : { facultyId: req.auth!.sub }),
        ...((dateFrom || dateTo) && { startedAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }),
      },
      include: {
        faculty: { select: { name: true } },
        subject: { select: { name: true, code: true } },
        room: { select: { name: true } },
        batch: { include: { _count: { select: { students: activeRoster } } } },
        records: { select: { status: true, method: true, student: { select: { isActive: true, archivedAt: true } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    const history = sessions.map((session) => {
      const totalStudents = expectedStudents(session.batch._count.students, session.records);
      const statusCounts: Record<string, number> = {};
      const methodCounts: Record<string, number> = {};
      for (const record of session.records) {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
        methodCounts[record.method] = (methodCounts[record.method] || 0) + 1;
      }
      const present = session.records.filter((record) => isPresentStatus(record.status)).length;
      return {
        sessionId: session.sessionId,
        batchId: session.batchId,
        facultyName: session.faculty.name,
        subjectName: session.subject.name,
        subjectCode: session.subject.code,
        roomName: session.room.name,
        batchName: session.batch.name,
        status: session.status,
        sessionType: session.sessionType,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        present,
        absent: Math.max(0, totalStudents - present - (statusCounts.LEAVE || 0)),
        totalStudents,
        statusCounts,
        methodCounts,
        attendancePercentage: totalStudents ? Math.round((present / totalStudents) * 10000) / 100 : 0,
      };
    });
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
}

export async function getSessionAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await prisma.attendanceSession.findFirst({
      where: req.auth!.role === 'ADMIN' ? { sessionId: req.params.sessionId } : { sessionId: req.params.sessionId, facultyId: req.auth!.sub },
      include: {
        faculty: { select: { name: true } },
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
          select: { studentId: true, status: true, scanTime: true, locationVerified: true, distanceFromCampus: true, method: true, overrideReason: true, updatedAt: true },
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
          overrideReason: record?.overrideReason ?? null,
          updatedAt: record?.updatedAt ?? null,
        };
      });

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
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
  } catch (err) { next(err); }
}

interface SubjectSummaryRow {
  subjectId: string;
  code: string;
  name: string;
  sessions: number;
  expected: number;
  attended: number;
  recentSessions: number;
}

/**
 * Dashboard numbers computed by the database instead of loading every session and record into memory.
 * A class counts once it has finished; "expected" is the active roster of its section, "attended" is
 * PRESENT / LATE / ON_DUTY among those same active students, so a percentage can never exceed 100.
 */
export async function analyticsSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const isAdmin = req.auth!.role === 'ADMIN';
    const facultyId = req.auth!.sub;
    const sectionIds = isAdmin ? null : await facultyBatchIds(facultyId);
    const facultyFilter = isAdmin ? Prisma.empty : Prisma.sql`AND s.faculty_id = ${facultyId}`;
    const weekAgo = new Date(Date.now() - WEEK_MS);

    const [subjects, sections, assignedClasses] = await Promise.all([
      prisma.$queryRaw<SubjectSummaryRow[]>(Prisma.sql`
        WITH finished AS (
          SELECT s.session_id, s.subject_id, s.batch_id, s.started_at
          FROM attendance_session s
          WHERE s.status IN ('ENDED', 'EXPIRED') ${facultyFilter}
        ), roster AS (
          SELECT batch_id, COUNT(*)::int AS size
          FROM student WHERE is_active AND archived_at IS NULL GROUP BY batch_id
        ), attended AS (
          SELECT r.session_id, COUNT(*)::int AS n
          FROM attendance_record r
          JOIN student st ON st.id = r.student_id AND st.is_active AND st.archived_at IS NULL
          WHERE r.status IN ('PRESENT', 'LATE', 'ON_DUTY') AND r.session_id IN (SELECT session_id FROM finished)
          GROUP BY r.session_id
        )
        SELECT f.subject_id AS "subjectId", sub.code, sub.name,
               COUNT(*)::int AS sessions,
               COALESCE(SUM(ro.size), 0)::int AS expected,
               COALESCE(SUM(a.n), 0)::int AS attended,
               COUNT(*) FILTER (WHERE f.started_at >= ${weekAgo})::int AS "recentSessions"
        FROM finished f
        JOIN subject sub ON sub.id = f.subject_id
        LEFT JOIN roster ro ON ro.batch_id = f.batch_id
        LEFT JOIN attended a ON a.session_id = f.session_id
        GROUP BY f.subject_id, sub.code, sub.name
        ORDER BY sub.code`),
      prisma.batch.findMany({
        where: { lifecycle: { not: 'ARCHIVED' }, ...(sectionIds ? { id: { in: sectionIds } } : {}) },
        select: { id: true, name: true, _count: { select: { students: activeRoster } } },
        orderBy: { name: 'asc' },
      }),
      prisma.timetableAllocation.count({ where: isAdmin ? {} : { facultyId } }),
    ]);

    const totals = subjects.reduce(
      (sum, row) => ({
        sessions: sum.sessions + row.sessions,
        expected: sum.expected + row.expected,
        attended: sum.attended + row.attended,
        recent: sum.recent + row.recentSessions,
      }),
      { sessions: 0, expected: 0, attended: 0, recent: 0 }
    );
    const percentage = (attended: number, expected: number) => (expected ? Math.round((attended / expected) * 1000) / 10 : null);

    res.json({
      success: true,
      data: {
        attendancePercentage: percentage(totals.attended, totals.expected),
        completedSessions: totals.sessions,
        sessionsThisWeek: totals.recent,
        assignedClasses,
        activeStudents: sections.reduce((sum, section) => sum + section._count.students, 0),
        sections: sections.map((section) => ({ id: section.id, name: section.name, students: section._count.students })),
        subjects: subjects.map((row) => ({
          subjectId: row.subjectId,
          code: row.code,
          name: row.name,
          sessions: row.sessions,
          percentage: percentage(row.attended, row.expected),
        })),
      },
    });
  } catch (err) { next(err); }
}

// What each filter on the audit screen stands for. Everything an administrator might want to review is covered.
const AUDIT_GROUPS: Record<string, string[]> = {
  signin: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'GOOGLE_LOGIN_SUCCESS', 'GOOGLE_LOGIN_FAILED', 'ADMIN_MFA_OTP_SENT', 'ADMIN_MFA_LOGIN_SUCCESS', 'ADMIN_LOGIN_MFA_UNAVAILABLE'],
  scans: ['QR_SCAN_ACCEPTED', 'QR_SCAN_REJECTED', 'BLE_BEACON_SCAN_ACCEPTED', 'BLE_BEACON_SCAN_REJECTED'],
  sessions: ['SESSION_STARTED', 'EXTRA_SESSION_STARTED', 'SESSION_ENDED', 'SESSION_PAUSED', 'SESSION_RESUMED', 'SESSION_CANCELLED', 'BLE_BEACON_PACKET_ISSUED', 'BLE_BEACON_PACKET_REVOKED'],
  overrides: ['MANUAL_ATTENDANCE_CREATED', 'ATTENDANCE_OVERRIDDEN'],
  accounts: ['PASSWORD_CHANGED', 'PASSWORD_RESET_CODE_ISSUED', 'STUDENT_DEVICE_RESET', 'PASSKEY_REGISTERED', 'PASSKEY_REGISTER_FAILED', 'REFRESH_REUSE_DETECTED'],
  setup: ['BATCH_ARCHIVE_APPROVED', 'BATCH_RETRIEVED', 'CALENDAR_EVENTS_IMPORTED', 'BLOCK_TESTS_IMPORTED'],
};

const auditQuerySchema = z.object({
  group: z.enum(['signin', 'scans', 'sessions', 'overrides', 'accounts', 'setup']).optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Administrator audit trail, newest first, with simple filters and "load older" paging. */
export async function listAuditLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { group, outcome, before, limit } = auditQuerySchema.parse(req.query);
    const rows = await prisma.auditLog.findMany({
      where: {
        ...(group && { action: { in: AUDIT_GROUPS[group] } }),
        ...(outcome && { success: outcome === 'success' }),
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);

    // Show people instead of ids.
    const idsOf = (type: 'ADMIN' | 'FACULTY' | 'STUDENT') => [...new Set(page.filter((row) => row.actorType === type && row.actorId).map((row) => row.actorId as string))];
    const [admins, faculty, students] = await Promise.all([
      prisma.admin.findMany({ where: { id: { in: idsOf('ADMIN') } }, select: { id: true, name: true } }),
      prisma.faculty.findMany({ where: { id: { in: idsOf('FACULTY') } }, select: { id: true, name: true } }),
      prisma.student.findMany({ where: { id: { in: idsOf('STUDENT') } }, select: { id: true, name: true, rollNo: true } }),
    ]);
    const names = new Map<string, string>([
      ...admins.map((row): [string, string] => [row.id, row.name]),
      ...faculty.map((row): [string, string] => [row.id, row.name]),
      ...students.map((row): [string, string] => [row.id, `${row.name} (${row.rollNo})`]),
    ]);

    res.json({
      success: true,
      data: {
        items: page.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          actorType: row.actorType,
          actorName: row.actorId ? names.get(row.actorId) ?? null : null,
          action: row.action,
          success: row.success,
          reasonCode: row.reasonCode,
          ip: row.ip,
          metadata: row.metadata,
        })),
        nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
      },
    });
  } catch (err) { next(err); }
}

const reportQuerySchema = z.object({
  batchId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
}).strict();

/**
 * Cumulative attendance per student for one section (optionally one subject). A session counts once it has
 * finished; PRESENT / LATE / ON_DUTY count as attended, matching the student dashboard. Faculty only see
 * their own sessions in sections they teach or mentor; admins see all.
 */
export async function attendanceReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId, subjectId } = reportQuerySchema.parse(req.query);
    const isAdmin = req.auth!.role === 'ADMIN';
    if (!isAdmin && !(await facultyBatchIds(req.auth!.sub)).includes(batchId)) {
      res.status(403).json({ success: false, code: 'SECTION_ACCESS_DENIED', message: 'You can only report on sections you teach or mentor.' });
      return;
    }

    const [batch, subject, sessions, students] = await Promise.all([
      prisma.batch.findUnique({ where: { id: batchId }, select: { name: true } }),
      subjectId ? prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true, code: true } }) : Promise.resolve(null),
      prisma.attendanceSession.findMany({
        where: {
          batchId,
          ...(subjectId ? { subjectId } : {}),
          status: { in: COMPLETED_SESSION_STATUSES },
          ...(isAdmin ? {} : { facultyId: req.auth!.sub }),
        },
        select: { sessionId: true },
      }),
      prisma.student.findMany({ where: { batchId, isActive: true }, select: { id: true, name: true, rollNo: true, regNo: true }, orderBy: { rollNo: 'asc' } }),
    ]);
    if (!batch) {
      res.status(404).json({ success: false, message: 'Section not found' });
      return;
    }

    const sessionIds = sessions.map((item) => item.sessionId);
    const attended = sessionIds.length === 0 ? [] : await prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: { sessionId: { in: sessionIds }, status: { in: PRESENT_STATUSES } },
      _count: { _all: true },
    });
    const attendedByStudent = new Map(attended.map((row) => [row.studentId, row._count._all]));
    const total = sessionIds.length;

    res.json({
      success: true,
      data: {
        batchName: batch.name,
        subjectName: subject?.name ?? null,
        subjectCode: subject?.code ?? null,
        totalSessions: total,
        students: students.map((student) => {
          const count = attendedByStudent.get(student.id) ?? 0;
          return {
            rollNo: student.rollNo,
            regNo: student.regNo,
            name: student.name,
            total,
            attended: count,
            percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 100,
            shortage: total > 0 && count / total < SHORTAGE_RATIO,
          };
        }),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
}
