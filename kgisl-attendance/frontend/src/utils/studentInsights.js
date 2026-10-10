// Real numbers behind the student dashboard badges. Everything is derived from the student's own attendance
// history (GET /students/me/attendance); nothing here is a placeholder.

export const PRESENT_STATUSES = ['PRESENT', 'LATE', 'ON_DUTY'];
const EARLY_MINUTES = 5;
const RECENT_DAYS = 30;

/** "YYYY-MM-DD" of an instant on the Indian calendar (classes are scheduled in IST whatever the phone's timezone). */
export function istDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Finished classes only; a class that is still running has not decided anybody's attendance yet. */
function finished(sessions = []) {
  return sessions.filter((session) => !session.inProgress);
}

/**
 * Consecutive class days, counting back from the most recent one, on which the student attended every class.
 * A day made up only of approved leave is skipped (it neither extends nor breaks the streak); any absence ends it.
 */
export function computeStreakDays(sessions = []) {
  const byDay = new Map();
  for (const session of finished(sessions)) {
    const day = istDayKey(session.startedAt);
    if (!day) continue;
    const entry = byDay.get(day) ?? { attended: 0, missed: 0 };
    if (PRESENT_STATUSES.includes(session.status)) entry.attended += 1;
    else if (session.status !== 'LEAVE') entry.missed += 1;
    byDay.set(day, entry);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  let streak = 0;
  for (const [, entry] of days) {
    if (entry.missed > 0) break;
    if (entry.attended > 0) streak += 1;
  }
  return streak;
}

/** Marked within five minutes of the class starting in at least three of the last five classes attended by scanning. */
export function isEarlyBird(sessions = []) {
  const scanned = finished(sessions)
    .filter((session) => PRESENT_STATUSES.includes(session.status) && session.method !== 'FACULTY_MANUAL' && session.scanTime)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 5);
  const early = scanned.filter((session) => {
    const minutes = (new Date(session.scanTime) - new Date(session.startedAt)) / 60_000;
    return minutes >= 0 && minutes <= EARLY_MINUTES;
  });
  return early.length >= 3;
}

/** At least one class in the last 30 days and no unexcused absence among them. */
export function hasNoRecentAbsence(sessions = [], now = new Date()) {
  const since = new Date(now).getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent = finished(sessions).filter((session) => new Date(session.startedAt).getTime() >= since);
  return recent.length > 0 && recent.every((session) => session.status !== 'ABSENT');
}

/** Overall percentage across subjects, or null when the student has no finished classes yet. */
export function overallPercentage(subjects = []) {
  const withClasses = subjects.filter((subject) => subject.total > 0);
  if (withClasses.length === 0) return null;
  return Math.round(withClasses.reduce((sum, subject) => sum + subject.percentage, 0) / withClasses.length);
}

/**
 * "Classes you can still miss / must attend" for the 75 % rule. `attended` and `total` are the student's real counts
 * for one subject.
 */
export function attendanceAdvice(attended = 0, total = 0, threshold = 0.75) {
  if (total === 0) return { status: 'SAFE', count: 0, text: 'No classes held yet.' };
  const ratio = attended / total;
  if (ratio >= threshold) {
    // Largest n such that attended / (total + n) still >= threshold.
    const canMiss = Math.floor(attended / threshold - total + 1e-9);
    if (canMiss > 0) {
      return { status: 'SAFE', count: canMiss, text: `Safe: you can miss ${canMiss} more class${canMiss > 1 ? 'es' : ''} and stay at ${Math.round(threshold * 100)}% or above.` };
    }
    return { status: 'MARGIN', count: 0, text: `Right on the ${Math.round(threshold * 100)}% line. Attend the next class to stay safe.` };
  }
  // Smallest n such that (attended + n) / (total + n) >= threshold.
  const needed = Math.ceil((threshold * total - attended) / (1 - threshold) - 1e-9);
  return { status: 'SHORTAGE', count: needed, text: `Shortage: attend the next ${needed} class${needed > 1 ? 'es' : ''} in a row to reach ${Math.round(threshold * 100)}%.` };
}

/** The Indian wall clock right now: day of week (1 = Monday … 7 = Sunday) and minutes since midnight. */
export function istNow(now = new Date()) {
  const ist = new Date(new Date(now).getTime() + 330 * 60_000);
  const weekday = ist.getUTCDay();
  return { dayOfWeek: weekday === 0 ? 7 : weekday, minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(), dateKey: ist.toISOString().slice(0, 10) };
}

function toMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

/** ACTIVE while the period is running, COMPLETED once it is over, otherwise UPCOMING. */
export function periodStatus(startTime, endTime, minutesNow) {
  if (minutesNow >= toMinutes(startTime) && minutesNow < toMinutes(endTime)) return 'ACTIVE';
  return minutesNow >= toMinutes(endTime) ? 'COMPLETED' : 'UPCOMING';
}

/** The student's own timetable rows for one day of the week, in order, with a running status. */
export function todaysPeriods(allocations = [], now = new Date()) {
  const { dayOfWeek, minutes } = istNow(now);
  return allocations
    .filter((allocation) => allocation.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((allocation, index) => ({ ...allocation, period: `Period ${index + 1}`, status: periodStatus(allocation.startTime, allocation.endTime, minutes) }));
}
