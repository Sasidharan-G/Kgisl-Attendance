/**
 * India Standard Time helpers.
 *
 * Timetable periods are stored as wall-clock "HH:MM" strings in IST while the
 * server (Render) runs in UTC, so every period/day/date decision must go through
 * these helpers instead of relying on the server's local timezone.
 */
export const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IstParts {
  year: number;
  month: number; // 0-11
  day: number;
  /** 1 = Monday … 7 = Sunday, matching TimetableAllocation.dayOfWeek. */
  dayOfWeek: number;
  /** Minutes since IST midnight. */
  minutes: number;
}

export function istParts(now: Date = new Date()): IstParts {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const weekday = ist.getUTCDay();
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    dayOfWeek: weekday === 0 ? 7 : weekday,
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

/** "09:10" -> 550. */
export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** The instant at which `HH:MM` IST occurs on the IST calendar day containing `now`. */
export function istTimeOnDay(value: string, now: Date = new Date()): Date {
  const parts = istParts(now);
  return new Date(Date.UTC(parts.year, parts.month, parts.day, 0, toMinutes(value)) - IST_OFFSET_MS);
}

/**
 * Start/end instants of the IST calendar day for a date that was supplied as a calendar day
 * (for example "2026-10-09" parsed as UTC midnight by the API layer).
 */
export function istDayWindow(calendarDay: Date): { start: Date; end: Date } {
  const start =
    Date.UTC(calendarDay.getUTCFullYear(), calendarDay.getUTCMonth(), calendarDay.getUTCDate()) - IST_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS - 1) };
}

/** UTC-midnight "calendar day" key for the IST day that contains `instant` (used to compare with date-only columns). */
export function istCalendarDay(instant: Date): Date {
  const parts = istParts(instant);
  return new Date(Date.UTC(parts.year, parts.month, parts.day));
}
