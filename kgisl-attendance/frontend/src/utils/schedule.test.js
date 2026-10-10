import { describe, expect, it } from 'vitest';
import { pickCurrentAllocation } from './schedule.js';

const friday = (id, startTime, endTime) => ({ id, dayOfWeek: 5, startTime, endTime });
const periods = [friday('p1', '09:10', '10:00'), friday('p2', '10:00', '10:50'), friday('p3', '11:10', '12:00'), { id: 'sat', dayOfWeek: 6, startTime: '10:00', endTime: '10:50' }];
// 2026-10-09 is a Friday. 04:30 UTC is 10:00 IST.
const at = (hhmmUtc) => new Date(`2026-10-09T${hhmmUtc}:00.000Z`);

describe('pre-selecting the current period for the faculty dashboard', () => {
  it('picks the class that is running', () => {
    expect(pickCurrentAllocation(periods, at('05:00'))?.id).toBe('p2'); // 10:30 IST
  });

  it('prefers the running class over the previous one still inside its grace window', () => {
    expect(pickCurrentAllocation(periods, at('04:35'))?.id).toBe('p2'); // 10:05 IST: p1 ended 5 min ago, p2 has started
  });

  it('opens the next class 15 minutes before it starts and prefers it to the one that just ended', () => {
    expect(pickCurrentAllocation(periods, at('05:26'))?.id).toBe('p3'); // 10:56 IST: p2 ended 6 min ago, p3 opens at 10:55
  });

  it('falls back to the class that has just ended while nothing else is open', () => {
    expect(pickCurrentAllocation(periods, at('05:22'))?.id).toBe('p2'); // 10:52 IST
  });

  it('returns null when no class is open, rather than guessing', () => {
    expect(pickCurrentAllocation(periods, at('10:00'))).toBeNull(); // 15:30 IST
    expect(pickCurrentAllocation([], at('05:00'))).toBeNull();
  });

  it('ignores classes on other days', () => {
    expect(pickCurrentAllocation([{ id: 'sat', dayOfWeek: 6, startTime: '10:00', endTime: '10:50' }], at('05:00'))).toBeNull();
  });
});
