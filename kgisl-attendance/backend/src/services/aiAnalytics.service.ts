import OpenAI from 'openai';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

type AgentRole = 'ADMIN' | 'FACULTY';
type SafeAnalyticsContext = { scope: 'institution' | 'your assigned sections'; activeStudents: number; activeSessions: number; attendanceRecords: number; countedPresent: number; attendanceRate: number | null; pendingLeaves: number; pendingCorrections: number; atRiskStudents: number };

/** Only aggregate, role-scoped data is permitted in the AI prompt. */
async function getSafeAnalytics(role: AgentRole, actorId: string): Promise<SafeAnalyticsContext> {
  let batchIds: string[] | undefined;
  if (role === 'FACULTY') {
    const allocations = await prisma.timetableAllocation.findMany({ where: { facultyId: actorId }, select: { batchId: true }, distinct: ['batchId'] });
    batchIds = allocations.map((allocation) => allocation.batchId);
  }
  const studentWhere = batchIds ? { batchId: { in: batchIds }, isActive: true } : { isActive: true };
  const sessionWhere = batchIds ? { batchId: { in: batchIds } } : {};
  const recordWhere = batchIds ? { session: { batchId: { in: batchIds } } } : {};
  const scopedStudent = batchIds ? { student: { batchId: { in: batchIds } } } : {};
  const [activeStudents, activeSessions, attendanceRecords, countedPresent, pendingLeaves, pendingCorrections, records] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.attendanceSession.count({ where: { ...sessionWhere, status: 'ACTIVE' } }),
    prisma.attendanceRecord.count({ where: recordWhere }),
    prisma.attendanceRecord.count({ where: { ...recordWhere, status: { in: ['PRESENT', 'LATE', 'ON_DUTY', 'LEAVE'] } } }),
    prisma.leaveRequest.count({ where: { status: 'PENDING', ...scopedStudent } }),
    prisma.attendanceCorrectionRequest.count({ where: { status: 'PENDING', ...scopedStudent } }),
    prisma.attendanceRecord.findMany({ where: recordWhere, select: { studentId: true, status: true }, take: 5000 }),
  ]);
  const perStudent = new Map<string, { total: number; attended: number }>();
  for (const record of records) { const value = perStudent.get(record.studentId) ?? { total: 0, attended: 0 }; value.total += 1; if (['PRESENT', 'LATE', 'ON_DUTY', 'LEAVE'].includes(record.status)) value.attended += 1; perStudent.set(record.studentId, value); }
  const atRiskStudents = [...perStudent.values()].filter((value) => value.total >= 3 && (value.attended / value.total) * 100 < 75).length;
  return { scope: role === 'ADMIN' ? 'institution' : 'your assigned sections', activeStudents, activeSessions, attendanceRecords, countedPresent, attendanceRate: attendanceRecords ? Math.round((countedPresent / attendanceRecords) * 1000) / 10 : null, pendingLeaves, pendingCorrections, atRiskStudents };
}

export async function askAttendanceAi(input: { message: string; role: AgentRole; actorId: string }) {
  if (!env.AI_AGENT_ENABLED || env.OPENAI_API_KEY.length < 20) return null;
  const analytics = await getSafeAnalytics(input.role, input.actorId);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 15_000, maxRetries: 1 });
  const response = await client.responses.create({
    model: env.OPENAI_MODEL, store: false, max_output_tokens: 300,
    instructions: 'You are a concise KGiSL attendance analytics assistant. Use only the supplied aggregate data. Do not invent data, expose personal information, reveal credentials/tokens/GPS/device data, or perform write actions. If detail is unavailable, say so. Answer in friendly Tanglish.',
    input: `User question: ${input.message}\n\nAuthorized aggregate analytics (${analytics.scope}): ${JSON.stringify(analytics)}`,
  });
  const reply = response.output_text.trim();
  return reply && reply.length <= 2500 ? reply : null;
}
