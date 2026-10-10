import { istNow } from './studentInsights.js';

function toMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * The period a faculty member most likely wants to start right now: today's class (Indian time) whose start window is
 * open, using the same "15 minutes before it starts until 15 minutes after it ends" rule the server enforces. The class
 * that is actually running wins over one that is only inside its grace window. Returns null when nothing is open, so the
 * dropdown is left for the faculty member to choose instead of guessing a wrong class.
 */
export function pickCurrentAllocation(allocations = [], now = new Date(), graceMinutes = 15) {
  const { dayOfWeek, minutes } = istNow(now);
  const open = allocations
    .filter((allocation) => allocation.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .filter((allocation) => minutes >= toMinutes(allocation.startTime) - graceMinutes && minutes <= toMinutes(allocation.endTime) + graceMinutes);
  if (open.length === 0) return null;
  const running = open.find((allocation) => minutes >= toMinutes(allocation.startTime) && minutes < toMinutes(allocation.endTime));
  if (running) return running;
  // Nothing is running: the next class about to start is far more likely than one that already finished.
  return open.find((allocation) => toMinutes(allocation.startTime) > minutes) ?? open[open.length - 1];
}
