/** A period can be opened this long before it starts and attendance stays open this long after it ends. */
export const PERIOD_GRACE_MINUTES = 15;
export const PERIOD_GRACE_MS = PERIOD_GRACE_MINUTES * 60_000;

/**
 * True once the class itself is over (not just the late-marking grace period). A scheduled session's
 * stored end already includes the grace period, so the nominal end is that minus the grace.
 */
export function isSessionPastNominalEnd(
  session: { sessionType: string; scheduledEndAt: Date | null },
  now: Date = new Date()
): boolean {
  if (!session.scheduledEndAt) return false;
  const graceMs = session.sessionType === 'SCHEDULED' ? PERIOD_GRACE_MS : 0;
  return session.scheduledEndAt.getTime() - graceMs <= now.getTime();
}
