import type { AttendanceStatus, SessionStatus } from '@prisma/client';

/**
 * Single source of truth for what counts as "attended". Every dashboard, report and live counter must use this so
 * the numbers a student, faculty member and admin see always agree.
 * (Approved LEAVE is excused from marking but, like before, does not count as attended.)
 */
export const PRESENT_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ON_DUTY'];

/** Sessions that have finished and therefore belong in percentage denominators. */
export const COMPLETED_SESSION_STATUSES: SessionStatus[] = ['ENDED', 'EXPIRED'];

/** Sessions a faculty member is still running (a student can still mark attendance in them). */
export const LIVE_SESSION_STATUSES: SessionStatus[] = ['ACTIVE', 'PAUSED'];

/** Below this share of attended classes a student is in "shortage". */
export const SHORTAGE_RATIO = 0.75;

export function isPresentStatus(status: string): boolean {
  return (PRESENT_STATUSES as string[]).includes(status);
}
