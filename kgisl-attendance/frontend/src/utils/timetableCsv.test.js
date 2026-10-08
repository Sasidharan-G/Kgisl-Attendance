import { describe, expect, it } from 'vitest';
import { parseDay, parseTime, parseTimetableCsv } from './timetableCsv.js';

const subjects = [{ id: 's1', code: 'AIML', name: 'AI & ML' }];
const faculty = [{ id: 'f1', name: 'Chithra M', email: 'Chithra@kgisl.edu' }];

describe('timetable csv', () => {
  it('parses days and times in common formats', () => {
    expect(parseDay('Mon')).toBe(1);
    expect(parseDay('friday')).toBe(5);
    expect(parseDay('7')).toBe(7);
    expect(parseDay('Funday')).toBeNull();
    expect(parseTime('9:10')).toBe('09:10');
    expect(parseTime('1:40 PM')).toBe('13:40');
    expect(parseTime('12:05 AM')).toBe('00:05');
    expect(parseTime('25:00')).toBeNull();
  });

  it('resolves subject and faculty and reports bad lines', () => {
    const csv = 'Day,Start,End,SubjectCode,FacultyEmail\nMonday,09:10,10:00,aiml,chithra@kgisl.edu\nTuesday,10:00,09:00,AIML,chithra@kgisl.edu\nWednesday,09:10,10:00,XYZ,chithra@kgisl.edu\nThursday,09:10,10:00,AIML,nobody@kgisl.edu\n';
    const { rows, errors } = parseTimetableCsv(csv, { subjects, faculty });
    expect(rows).toEqual([{ line: 2, dayOfWeek: 1, startTime: '09:10', endTime: '10:00', subjectId: 's1', subjectCode: 'AIML', facultyId: 'f1', facultyName: 'Chithra M' }]);
    expect(errors.map((error) => error.line)).toEqual([3, 4, 5]);
  });

  it('rejects a file without the required columns', () => {
    const { rows, errors } = parseTimetableCsv('foo,bar\n1,2\n', { subjects, faculty });
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/Missing column/);
  });
});
