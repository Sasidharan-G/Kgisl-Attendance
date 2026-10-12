import { describe, expect, it } from 'vitest';
import { attendanceAdvice, computeStreakDays, hasNoRecentAbsence, isEarlyBird, istDayKey, overallPercentage } from './studentInsights.js';
import { parseBlockTestCsv, parseCalendarCsv, parseCalendarDate } from './calendarCsv.js';

// 04:00 UTC = 09:30 IST on the same calendar day.
const at = (date, hhmmUtc = '04:00') => `${date}T${hhmmUtc}:00.000Z`;
const session = (date, status, extra = {}) => ({ startedAt: at(date), status, inProgress: false, method: 'BEACON', ...extra });

describe('streaks and badges use the real attendance history', () => {
  it('counts consecutive fully attended class days and stops at the first absence', () => {
    const sessions = [
      session('2026-10-05', 'PRESENT'),
      session('2026-10-06', 'ABSENT'),
      session('2026-10-07', 'PRESENT'),
      session('2026-10-07', 'LATE'),
      session('2026-10-08', 'ON_DUTY'),
    ];
    expect(computeStreakDays(sessions)).toBe(2); // 07th and 08th
    expect(computeStreakDays([])).toBe(0);
  });

  it('ignores a class that is still running and skips days that were only approved leave', () => {
    const sessions = [
      { ...session('2026-10-09', 'ABSENT'), inProgress: true },
      session('2026-10-08', 'LEAVE'),
      session('2026-10-07', 'PRESENT'),
    ];
    expect(computeStreakDays(sessions)).toBe(1);
  });

  it('puts a class on the Indian day, not the UTC day', () => {
    expect(istDayKey('2026-10-08T20:00:00.000Z')).toBe('2026-10-09');
    expect(istDayKey('nonsense')).toBe('');
  });

  it('early bird needs three early scans among the last five scanned classes', () => {
    const early = (date) => session(date, 'PRESENT', { scanTime: at(date, '04:03') });
    const late = (date) => session(date, 'PRESENT', { scanTime: at(date, '04:20') });
    expect(isEarlyBird([early('2026-10-01'), early('2026-10-02'), early('2026-10-03'), late('2026-10-04'), late('2026-10-05')])).toBe(true);
    expect(isEarlyBird([early('2026-10-01'), early('2026-10-02'), late('2026-10-03'), late('2026-10-04'), late('2026-10-05')])).toBe(false);
    // Marks entered by faculty are not scans.
    expect(isEarlyBird([1, 2, 3].map((n) => session(`2026-10-0${n}`, 'PRESENT', { method: 'FACULTY_MANUAL', scanTime: at(`2026-10-0${n}`, '04:01') })))).toBe(false);
  });

  it('"no recent absence" needs at least one class and none missed in the last 30 days', () => {
    const now = new Date('2026-10-10T10:00:00Z');
    expect(hasNoRecentAbsence([], now)).toBe(false);
    expect(hasNoRecentAbsence([session('2026-10-05', 'PRESENT')], now)).toBe(true);
    expect(hasNoRecentAbsence([session('2026-10-05', 'PRESENT'), session('2026-10-06', 'ABSENT')], now)).toBe(false);
    expect(hasNoRecentAbsence([session('2026-08-01', 'ABSENT'), session('2026-10-05', 'PRESENT')], now)).toBe(true);
  });

  it('overall percentage ignores subjects with no classes yet', () => {
    expect(overallPercentage([])).toBeNull();
    expect(overallPercentage([{ total: 0, percentage: 100 }])).toBeNull();
    expect(overallPercentage([{ total: 10, percentage: 80 }, { total: 5, percentage: 60 }, { total: 0, percentage: 100 }])).toBe(70);
  });
});

describe('75% advice uses the real counts', () => {
  it('tells a safe student how many classes can be missed', () => {
    expect(attendanceAdvice(16, 20)).toMatchObject({ status: 'SAFE', count: 1 });
    expect(attendanceAdvice(30, 30)).toMatchObject({ status: 'SAFE', count: 10 });
  });

  it('flags the exact margin without floating point surprises', () => {
    expect(attendanceAdvice(15, 20)).toMatchObject({ status: 'MARGIN', count: 0 });
    expect(attendanceAdvice(3, 4)).toMatchObject({ status: 'MARGIN', count: 0 });
  });

  it('tells a student in shortage how many consecutive classes are needed', () => {
    expect(attendanceAdvice(10, 20)).toMatchObject({ status: 'SHORTAGE', count: 20 });
    expect(attendanceAdvice(5, 10)).toMatchObject({ status: 'SHORTAGE', count: 10 });
    const needed = attendanceAdvice(7, 10).count;
    expect((7 + needed) / (10 + needed)).toBeGreaterThanOrEqual(0.75);
    expect((7 + needed - 1) / (10 + needed - 1)).toBeLessThan(0.75);
  });

  it('does not invent numbers when no class has been held', () => {
    expect(attendanceAdvice(0, 0)).toMatchObject({ status: 'SAFE', count: 0 });
    expect(attendanceAdvice(undefined, undefined)).toMatchObject({ status: 'SAFE' });
  });
});

describe('calendar csv import', () => {
  it('reads dates in the common Indian formats and rejects impossible ones', () => {
    expect(parseCalendarDate('2026-10-20')).toBe('2026-10-20');
    expect(parseCalendarDate('20-10-2026')).toBe('2026-10-20');
    expect(parseCalendarDate('5/1/2026')).toBe('2026-01-05');
    expect(parseCalendarDate('31-02-2026')).toBeNull();
    expect(parseCalendarDate('soon')).toBeNull();
  });

  it('turns the chosen file into rows and line-numbered errors instead of inserting sample data', () => {
    const csv = [
      'date,title,type,description',
      '2026-10-20,Mid-Semester Examinations,exam,Theory and practical',
      '08-11-2026,"Diwali, festival",HOLIDAY,',
      '2026-13-01,Broken date,EVENT,',
      '2026-12-25,Christmas,PARTY,',
      '2026-12-26,Boxing Day,,',
    ].join('\n');
    const { rows, errors } = parseCalendarCsv(csv);
    expect(rows.map((row) => [row.date, row.title, row.type])).toEqual([
      ['2026-10-20', 'Mid-Semester Examinations', 'EXAM'],
      ['2026-11-08', 'Diwali, festival', 'HOLIDAY'],
      ['2026-12-26', 'Boxing Day', 'EVENT'],
    ]);
    expect(errors.map((error) => error.line)).toEqual([4, 5]);
    expect(errors[1].message).toContain('PARTY');
  });

  it('explains a file with the wrong header', () => {
    const { rows, errors } = parseCalendarCsv('foo,bar\n1,2');
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain('Missing column');
  });

  it('maps block tests to sections and treats a blank section as every section', () => {
    const batches = [{ id: 'b-c', name: 'MCA-C' }];
    const csv = [
      'date,start,end,subjectCode,subjectName,room,section',
      '2026-10-26,09:30,12:30,aiml,AI & ML,Exam Hall 1,mca-c',
      '2026-10-27,1:30 PM,4:30 PM,PHP,,Hall 2,',
      '2026-10-28,09:30,09:00,OSC,Open Source,Hall 3,MCA-C',
      '2026-10-29,09:30,12:30,CC,Cloud,Hall 4,MCA-Z',
    ].join('\n');
    const { rows, errors } = parseBlockTestCsv(csv, { batches });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ subjectCode: 'AIML', batchId: 'b-c', startTime: '09:30', endTime: '12:30' });
    expect(rows[1]).toMatchObject({ subjectCode: 'PHP', subjectName: 'PHP', batchId: null, startTime: '13:30', endTime: '16:30' });
    expect(errors.map((error) => error.line)).toEqual([4, 5]);
  });
});

describe('today\'s schedule comes from the real timetable', async () => {
  const { istNow, periodStatus, todaysPeriods } = await import('./studentInsights.js');
  const allocations = [
    { id: 'b', dayOfWeek: 5, startTime: '10:00', endTime: '10:50', subject: { code: 'PHP' } },
    { id: 'a', dayOfWeek: 5, startTime: '09:10', endTime: '10:00', subject: { code: 'AIML' } },
    { id: 'x', dayOfWeek: 6, startTime: '09:10', endTime: '10:00', subject: { code: 'SAT' } },
  ];

  it('reads the Indian day and clock from any instant', () => {
    // 2026-10-09 04:30 UTC is Friday 10:00 in India.
    expect(istNow(new Date('2026-10-09T04:30:00Z'))).toEqual({ dayOfWeek: 5, minutes: 600, dateKey: '2026-10-09' });
    // 2026-10-10 20:00 UTC is already Sunday 01:30 in India.
    expect(istNow(new Date('2026-10-10T20:00:00Z'))).toMatchObject({ dayOfWeek: 7, minutes: 90 });
  });

  it('marks periods as completed, live or upcoming and numbers them in time order', () => {
    expect(periodStatus('09:10', '10:00', 600)).toBe('COMPLETED');
    expect(periodStatus('10:00', '10:50', 600)).toBe('ACTIVE');
    expect(periodStatus('10:50', '11:10', 600)).toBe('UPCOMING');
    const periods = todaysPeriods(allocations, new Date('2026-10-09T04:30:00Z'));
    expect(periods.map((p) => [p.period, p.subject.code, p.status])).toEqual([
      ['Period 1', 'AIML', 'COMPLETED'],
      ['Period 2', 'PHP', 'ACTIVE'],
    ]);
    expect(todaysPeriods(allocations, new Date('2026-10-11T06:00:00Z'))).toEqual([]); // Sunday: no classes
  });
});
