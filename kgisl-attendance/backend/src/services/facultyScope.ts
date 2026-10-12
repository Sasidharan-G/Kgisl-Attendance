import { prisma } from '../config/prisma';

/** The sections a faculty member answers for: the ones they teach (timetable) and the ones they mentor. */
export async function facultyBatchIds(facultyId: string): Promise<string[]> {
  const [taught, mentored] = await Promise.all([
    prisma.timetableAllocation.findMany({ where: { facultyId }, select: { batchId: true }, distinct: ['batchId'] }),
    prisma.batch.findMany({ where: { mentorId: facultyId }, select: { id: true } }),
  ]);
  return [...new Set([...taught.map((item) => item.batchId), ...mentored.map((item) => item.id)])];
}
