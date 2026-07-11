import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

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
