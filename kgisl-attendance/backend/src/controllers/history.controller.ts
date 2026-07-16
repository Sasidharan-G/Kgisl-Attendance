import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export async function listSessionHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFrom = typeof req.query.dateFrom === 'string' ? new Date(req.query.dateFrom) : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? new Date(req.query.dateTo) : undefined;
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dateTo))) dateTo.setUTCHours(23, 59, 59, 999);
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
        batch: {
          include: {
            _count: {
              select: { students: true }
            }
          }
        },
        records: { select: { status: true, method: true } }
      },
      orderBy: { startedAt: 'desc' },
    });

    const history = sessions.map((session) => {
      const totalStudents = session.batch._count.students;
      const statusCounts = session.records.reduce<Record<string, number>>((counts, record) => {
        counts[record.status] = (counts[record.status] || 0) + 1;
        return counts;
      }, {});
      const methodCounts = session.records.reduce<Record<string, number>>((counts, record) => {
        counts[record.method] = (counts[record.method] || 0) + 1;
        return counts;
      }, {});
      const present = (statusCounts.PRESENT || 0) + (statusCounts.LATE || 0) + (statusCounts.ON_DUTY || 0);
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
              select: { id: true, name: true, rollNo: true, regNo: true, email: true },
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
    const students = session.batch.students.map((student) => {
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
    const sessions = await prisma.attendanceSession.findMany({
      where: req.auth!.role === 'ADMIN' ? {} : { facultyId: req.auth!.sub },
      include: { batch: { include: { _count: { select: { students: { where: { isActive: true } } } } } }, records: { select: { status: true } } },
    });
    const statusCounts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, ON_DUTY: 0, LEAVE: 0 };
    let expected = 0;
    for (const session of sessions) {
      expected += session.batch._count.students;
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
