/**
 * Formats a 24-hour time string (e.g. "09:10" or "13:40") to 12-hour AM/PM format (e.g. "09:10 AM" or "01:40 PM").
 * @param {string} timeStr - Time in "HH:mm" format.
 * @returns {string} Formatted 12-hour time string.
 */
export function format12Hour(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return timeStr;
  
  let h = parseInt(parts[0], 10);
  const m = parts[1].slice(0, 2);
  if (isNaN(h)) return timeStr;

  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const formattedH = h < 10 ? `0${h}` : `${h}`;
  return `${formattedH}:${m} ${ampm}`;
}

/**
 * Formats a start and end time pair to 12-hour range (e.g. "09:10 AM – 10:00 AM").
 */
export function format12HourRange(startTime, endTime) {
  if (!startTime || !endTime) return '';
  return `${format12Hour(startTime)} – ${format12Hour(endTime)}`;
}
