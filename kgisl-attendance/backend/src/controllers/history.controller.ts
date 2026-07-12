import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export async function listSessionHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await prisma.attendanceSession.findMany({
      where: req.auth!.role === 'ADMIN' ? {} : { facultyId: req.auth!.sub },
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
        records: {
          where: { status: 'PRESENT' }
        }
      },
      orderBy: { startedAt: 'desc' },
    });

    const history = sessions.map((session) => {
      const totalStudents = session.batch._count.students;
      const present = session.records.length;
      const absent = Math.max(0, totalStudents - present);

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
          where: { status: 'PRESENT' },
          select: {
            studentId: true,
            scanTime: true,
            locationVerified: true,
            distanceFromCampus: true,
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
        attendanceStatus: record ? 'PRESENT' : 'ABSENT',
        scanTime: record?.scanTime ?? null,
        locationVerified: record?.locationVerified ?? false,
        distanceFromCampus: record?.distanceFromCampus ?? null,
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
