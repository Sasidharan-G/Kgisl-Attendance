import type { AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { istCalendarDay, istDayWindow } from '../utils/time';

type ApprovedType = 'LEAVE' | 'ON_DUTY';

const statusFor = (type: ApprovedType): AttendanceStatus => (type === 'ON_DUTY' ? 'ON_DUTY' : 'LEAVE');

/**
 * Approving a request must never undo something that really happened. A student who actually
 * attended keeps PRESENT/LATE, an explicit faculty ABSENT override is left alone, and the only
 * upgrade allowed is plain LEAVE -> ON_DUTY (on-duty counts as attended).
 */
export function shouldReplaceWithApproved(current: string, approved: ApprovedType): boolean {
  return approved === 'ON_DUTY' && current === 'LEAVE';
}

/**
 * Applies approved leave/OD to a session that has just started, so classes that happen *after*
 * the approval (the normal case: leave is approved ahead of time) are excused automatically.
 */
export async function applyApprovedLeavesToSession(session: {
  sessionId: string;
  batchId: string;
  startedAt: Date;
}): Promise<number> {
  const day = istCalendarDay(session.startedAt);
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      fromDate: { lte: day },
      toDate: { gte: day },
      student: { batchId: session.batchId, isActive: true, archivedAt: null },
    },
    orderBy: { reviewedAt: 'asc' },
    select: { studentId: true, type: true, reviewedBy: true, reviewNote: true },
  });
  if (leaves.length === 0) return 0;

  // One record per student; on-duty outranks plain leave if both cover the same day.
  const chosen = new Map<string, (typeof leaves)[number]>();
  for (const leave of leaves) {
    const current = chosen.get(leave.studentId);
    if (!current || (leave.type === 'ON_DUTY' && current.type !== 'ON_DUTY')) chosen.set(leave.studentId, leave);
  }

  const created = await prisma.attendanceRecord.createMany({
    data: [...chosen.values()].map((leave) => ({
      studentId: leave.studentId,
      sessionId: session.sessionId,
      status: statusFor(leave.type),
      method: 'FACULTY_MANUAL' as const,
      locationVerificationStatus: 'APPROVED_REQUEST',
      markedByFacultyId: leave.reviewedBy ?? null,
      overrideReason: leave.reviewNote ?? 'Approved leave request',
    })),
    skipDuplicates: true,
  });
  return created.count;
}

/** Applies a just-approved request to sessions that already exist inside its (IST) date range. */
export async function applyLeaveRequestToExistingSessions(
  request: { studentId: string; batchId: string; type: ApprovedType; fromDate: Date; toDate: Date },
  reviewer: { id: string; note: string }
): Promise<{ created: number; upgraded: number }> {
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      batchId: request.batchId,
      startedAt: { gte: istDayWindow(request.fromDate).start, lte: istDayWindow(request.toDate).end },
    },
    select: { sessionId: true },
  });
  if (sessions.length === 0) return { created: 0, upgraded: 0 };

  const status = statusFor(request.type);
  const existing = await prisma.attendanceRecord.findMany({
    where: { studentId: request.studentId, sessionId: { in: sessions.map((s) => s.sessionId) } },
    select: { sessionId: true, status: true },
  });
  const current = new Map(existing.map((record) => [record.sessionId, record.status]));

  const toCreate: string[] = [];
  const toUpgrade: string[] = [];
  for (const { sessionId } of sessions) {
    const existingStatus = current.get(sessionId);
    if (existingStatus === undefined) toCreate.push(sessionId);
    else if (shouldReplaceWithApproved(existingStatus, request.type)) toUpgrade.push(sessionId);
  }

  const [created, upgraded] = await prisma.$transaction([
    prisma.attendanceRecord.createMany({
      data: toCreate.map((sessionId) => ({
        studentId: request.studentId,
        sessionId,
        status,
        method: 'FACULTY_MANUAL' as const,
        locationVerificationStatus: 'APPROVED_REQUEST',
        markedByFacultyId: reviewer.id,
        overrideReason: reviewer.note,
      })),
      skipDuplicates: true,
    }),
    prisma.attendanceRecord.updateMany({
      where: { studentId: request.studentId, sessionId: { in: toUpgrade } },
      data: { status, markedByFacultyId: reviewer.id, overrideReason: reviewer.note },
    }),
  ]);
  return { created: created.count, upgraded: upgraded.count };
}
