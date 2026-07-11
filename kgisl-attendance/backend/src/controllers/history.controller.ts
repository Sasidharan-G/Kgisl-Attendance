import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export async function listSessionHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await prisma.attendanceSession.findMany({
      where: { facultyId: req.auth!.sub },
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
