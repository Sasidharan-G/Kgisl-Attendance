/**
 * Timetable CSV import. Columns (header row required, any order):
 *   day, start, end, subjectCode, facultyEmail
 * day: Monday..Sunday (or Mon..Sun, or 1-7). start/end: 24h "13:40" or "1:40 PM".
 */
export const TIMETABLE_CSV_TEMPLATE = 'day,start,end,subjectCode,facultyEmail\nMonday,09:10,10:00,AIML,faculty@example.edu\nMonday,10:00,10:50,PHP,faculty@example.edu\n';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Splits one CSV line, honouring double quotes. */
function splitLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; } else if (char === '"') quoted = false; else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { cells.push(current.trim()); current = ''; } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseDay(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (/^[1-7]$/.test(text)) return Number(text);
  const index = DAY_NAMES.findIndex((name) => name === text || (text.length >= 3 && name.startsWith(text)));
  return index >= 0 ? index + 1 : null;
}

export function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Returns { rows, errors }. Each row is ready for createAllocation (minus batch/room);
 * errors list the 1-based CSV line and the reason. Nothing is created here.
 */
export function parseTimetableCsv(text, { subjects, faculty }) {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return { rows: [], errors: [{ line: 1, message: 'The file needs a header row and at least one class.' }] };

  const header = splitLine(lines[0]).map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''));
  const columnOf = (...names) => header.findIndex((cell) => names.includes(cell));
  const columns = {
    day: columnOf('day', 'dayofweek'),
    start: columnOf('start', 'starttime', 'from'),
    end: columnOf('end', 'endtime', 'to'),
    subject: columnOf('subjectcode', 'subject', 'code'),
    faculty: columnOf('facultyemail', 'faculty', 'email'),
  };
  const missing = Object.entries(columns).filter(([, index]) => index < 0).map(([name]) => name);
  if (missing.length > 0) return { rows: [], errors: [{ line: 1, message: `Missing column(s): ${missing.join(', ')}. Use: day,start,end,subjectCode,facultyEmail` }] };

  const subjectByCode = new Map(subjects.map((subject) => [String(subject.code).toLowerCase(), subject]));
  const facultyByEmail = new Map(faculty.map((member) => [String(member.email ?? '').toLowerCase(), member]));
  const rows = [];
  const errors = [];

  lines.slice(1).forEach((line, offset) => {
    const lineNumber = offset + 2;
    const cells = splitLine(line);
    const dayOfWeek = parseDay(cells[columns.day]);
    const startTime = parseTime(cells[columns.start]);
    const endTime = parseTime(cells[columns.end]);
    const subject = subjectByCode.get(String(cells[columns.subject] ?? '').toLowerCase());
    const member = facultyByEmail.get(String(cells[columns.faculty] ?? '').toLowerCase());
    const problem = dayOfWeek === null ? `Unknown day "${cells[columns.day] ?? ''}"`
      : !startTime ? `Invalid start time "${cells[columns.start] ?? ''}"`
        : !endTime ? `Invalid end time "${cells[columns.end] ?? ''}"`
          : startTime >= endTime ? 'End time must be after start time'
            : !subject ? `Subject code "${cells[columns.subject] ?? ''}" is not in Academic Setup`
              : !member ? `No faculty with email "${cells[columns.faculty] ?? ''}"` : null;
    if (problem) errors.push({ line: lineNumber, message: problem });
    else rows.push({ line: lineNumber, dayOfWeek, startTime, endTime, subjectId: subject.id, subjectCode: subject.code, facultyId: member.id, facultyName: member.name });
  });
  return { rows, errors };
}
