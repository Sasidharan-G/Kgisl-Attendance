import type { AttendanceStatus, SessionStatus } from '@prisma/client';

/**
 * Single source of truth for what counts as "attended". Every dashboard, report and live
 * counter must use this so the numbers a student, faculty member and admin see always agree.
 * (Approved LEAVE is excused from marking but, like before, does not count as attended.)
 */
export const PRESENT_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ON_DUTY'];

/** Sessions that have finished and therefore belong in percentage denominators. */
export const COMPLETED_SESSION_STATUSES: SessionStatus[] = ['ENDED', 'EXPIRED'];

/** Sessions a faculty member is still running (a student can still mark attendance in them). */
export const LIVE_SESSION_STATUSES: SessionStatus[] = ['ACTIVE', 'PAUSED'];

export const SHORTAGE_RATIO = 0.75;

export function isPresentStatus(status: string): boolean {
  return (PRESENT_STATUSES as string[]).includes(status);
}

export interface SessionStats {
  totalStudents: number;
  present: number;
  leave: number;
  absent: number;
  progressPercent: number;
}

/**
 * Live/summary counters for one session.
 *
 * The roster is every active student in the batch; a student who has since been deactivated but
 * already has a record for this session is still counted so historic numbers never go negative.
 */
export function buildSessionStats(
  rosterIds: Iterable<string>,
  records: Array<{ studentId: string; status: string }>
): SessionStats {
  const everyone = new Set<string>(rosterIds);
  let present = 0;
  let leave = 0;
  for (const record of records) {
    everyone.add(record.studentId);
    if (isPresentStatus(record.status)) present += 1;
    else if (record.status === 'LEAVE') leave += 1;
  }
  const totalStudents = everyone.size;
  return {
    totalStudents,
    present,
    leave,
    absent: Math.max(0, totalStudents - present - leave),
    progressPercent: totalStudents === 0 ? 0 : Math.round((present / totalStudents) * 10000) / 100,
  };
}
