/**
 * CSV import for the academic calendar and the block-test timetable.
 *
 * These replace a fake "Analyze document" button that ignored the uploaded file and always inserted the same
 * hard-coded sample rows. Here the rows come from the file the administrator actually chose, they are previewed
 * with line-numbered errors, and nothing is saved until the administrator confirms.
 */
import { parseTime, splitLine } from './timetableCsv.js';

export const CALENDAR_CSV_TEMPLATE = 'date,title,type,description\n2026-10-20,Mid-Semester Examinations,EXAM,Theory and practical\n2026-11-08,Diwali,HOLIDAY,Festival holiday\n';
export const BLOCK_TEST_CSV_TEMPLATE = 'date,start,end,subjectCode,subjectName,room,section\n2026-10-26,09:30,12:30,AIML,Artificial Intelligence & ML,Exam Hall 1,MCA-C\n';

const EVENT_TYPES = ['HOLIDAY', 'EXAM', 'EVENT', 'WORKING'];

/** Accepts 2026-10-20, 20-10-2026 and 20/10/2026 (the usual Indian order). Returns "YYYY-MM-DD" or null. */
export function parseCalendarDate(value) {
  const text = String(value ?? '').trim();
  let year; let month; let day;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) [, year, month, day] = match;
  else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text))) [, day, month, year] = match;
  else return null;
  const y = Number(year); const m = Number(month); const d = Number(day);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function readTable(text, aliases, requiredHint) {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return { error: 'The file needs a header row and at least one data row.' };
  const header = splitLine(lines[0]).map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''));
  const columns = {};
  const missing = [];
  for (const [name, { names, required }] of Object.entries(aliases)) {
    columns[name] = header.findIndex((cell) => names.includes(cell));
    if (required && columns[name] < 0) missing.push(name);
  }
  if (missing.length > 0) return { error: `Missing column(s): ${missing.join(', ')}. Use: ${requiredHint}` };
  return { lines, columns };
}

/** Returns { rows, errors } ready for POST /calendar/events/bulk. */
export function parseCalendarCsv(text) {
  const table = readTable(text, {
    date: { names: ['date', 'day'], required: true },
    title: { names: ['title', 'event', 'name', 'holiday'], required: true },
    type: { names: ['type', 'category'], required: false },
    description: { names: ['description', 'details', 'notes'], required: false },
  }, 'date,title,type,description');
  if (table.error) return { rows: [], errors: [{ line: 1, message: table.error }] };

  const rows = [];
  const errors = [];
  table.lines.slice(1).forEach((line, offset) => {
    const lineNumber = offset + 2;
    const cells = splitLine(line);
    const date = parseCalendarDate(cells[table.columns.date]);
    const title = String(cells[table.columns.title] ?? '').trim();
    const rawType = table.columns.type >= 0 ? String(cells[table.columns.type] ?? '').trim().toUpperCase() : '';
    const type = rawType === '' ? 'EVENT' : EVENT_TYPES.includes(rawType) ? rawType : null;
    const description = table.columns.description >= 0 ? String(cells[table.columns.description] ?? '').trim().slice(0, 300) : '';
    const problem = !date ? `Unreadable date "${cells[table.columns.date] ?? ''}" (use YYYY-MM-DD or DD-MM-YYYY)`
      : title.length < 2 ? 'The title is missing'
        : title.length > 150 ? 'The title is longer than 150 characters'
          : !type ? `Unknown type "${rawType}" (use ${EVENT_TYPES.join(', ')})` : null;
    if (problem) errors.push({ line: lineNumber, message: problem });
    else rows.push({ line: lineNumber, date, title, type, description });
  });
  return { rows, errors };
}

/**
 * Returns { rows, errors } ready for POST /calendar/block-tests/bulk.
 * `batches` is [{ id, name }]; a blank section means the test applies to every section.
 */
export function parseBlockTestCsv(text, { batches = [] } = {}) {
  const table = readTable(text, {
    date: { names: ['date', 'day'], required: true },
    start: { names: ['start', 'starttime', 'from'], required: true },
    end: { names: ['end', 'endtime', 'to'], required: true },
    subjectCode: { names: ['subjectcode', 'code', 'subject'], required: true },
    subjectName: { names: ['subjectname', 'name'], required: false },
    room: { names: ['room', 'hall', 'venue'], required: true },
    section: { names: ['section', 'class', 'batch'], required: false },
  }, 'date,start,end,subjectCode,subjectName,room,section');
  if (table.error) return { rows: [], errors: [{ line: 1, message: table.error }] };

  const batchByName = new Map(batches.map((batch) => [String(batch.name).trim().toLowerCase(), batch]));
  const rows = [];
  const errors = [];
  table.lines.slice(1).forEach((line, offset) => {
    const lineNumber = offset + 2;
    const cells = splitLine(line);
    const date = parseCalendarDate(cells[table.columns.date]);
    const startTime = parseTime(cells[table.columns.start]);
    const endTime = parseTime(cells[table.columns.end]);
    const subjectCode = String(cells[table.columns.subjectCode] ?? '').trim().toUpperCase();
    const subjectName = (table.columns.subjectName >= 0 ? String(cells[table.columns.subjectName] ?? '').trim() : '') || subjectCode;
    const room = String(cells[table.columns.room] ?? '').trim();
    const sectionName = table.columns.section >= 0 ? String(cells[table.columns.section] ?? '').trim() : '';
    const batch = sectionName ? batchByName.get(sectionName.toLowerCase()) : null;
    const problem = !date ? `Unreadable date "${cells[table.columns.date] ?? ''}"`
      : !startTime ? `Invalid start time "${cells[table.columns.start] ?? ''}"`
        : !endTime ? `Invalid end time "${cells[table.columns.end] ?? ''}"`
          : startTime >= endTime ? 'End time must be after start time'
            : !subjectCode ? 'The subject code is missing'
              : !room ? 'The room is missing'
                : sectionName && !batch ? `Section "${sectionName}" does not exist in Academic Setup` : null;
    if (problem) errors.push({ line: lineNumber, message: problem });
    else rows.push({ line: lineNumber, date, startTime, endTime, subjectCode, subjectName, room, batchId: batch ? batch.id : null, batchName: batch ? batch.name : null });
  });
  return { rows, errors };
}
