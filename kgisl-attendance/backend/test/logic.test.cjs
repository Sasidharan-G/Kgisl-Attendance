// Regression tests for the logic fixes made during the full audit. They exercise pure functions and the
// rate limiters through a real (in-process) HTTP server, so they need neither Postgres nor Redis.
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_IP_RATE_LIMIT_MAX = '1000';
process.env.PASSWORD_RESET_RATE_LIMIT_MAX = '2';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Prisma } = require('@prisma/client');

const { istParts, istTimeOnDay, istDayWindow, istCalendarDay, toMinutes } = require('../dist/utils/time.js');
const { buildSessionStats, isPresentStatus, PRESENT_STATUSES } = require('../dist/utils/attendanceStatus.js');
const { isSessionPastNominalEnd } = require('../dist/utils/sessionWindow.js');
const { shouldReplaceWithApproved } = require('../dist/services/leave.service.js');
const { canJoinSessionRoom } = require('../dist/websocket/socket.js');
const { parseDateFilter } = require('../dist/controllers/history.controller.js');
const { mapPrismaError } = require('../dist/middleware/errorHandler.middleware.js');
const { accountKey, authRateLimiter, passwordResetRequestLimiter } = require('../dist/middleware/authLimiters.middleware.js');

const iso = (date) => date.toISOString();

// ---- India Standard Time helpers --------------------------------------------------------------

test('istParts reads the Indian wall clock from a UTC instant', () => {
  // 2026-10-10 20:00 UTC is 2026-10-11 01:30 in India, which is a Sunday.
  const parts = istParts(new Date('2026-10-10T20:00:00Z'));
  assert.deepEqual(parts, { year: 2026, month: 9, day: 11, dayOfWeek: 7, minutes: 90 });
  // Monday maps to 1, not 0/1 confusion
  assert.equal(istParts(new Date('2026-10-12T06:00:00Z')).dayOfWeek, 1);
});

test('istTimeOnDay places a period time on the IST day, not the server day', () => {
  assert.equal(iso(istTimeOnDay('09:10', new Date('2026-10-09T05:00:00Z'))), '2026-10-09T03:40:00.000Z');
  // 00:30 IST on the 10th is still the 9th in UTC; the helper must follow the IST day.
  assert.equal(iso(istTimeOnDay('09:10', new Date('2026-10-09T19:00:00Z'))), '2026-10-10T03:40:00.000Z');
  assert.equal(toMinutes('13:40'), 820);
});

test('istDayWindow spans the whole Indian calendar day', () => {
  const window = istDayWindow(new Date('2026-10-09T00:00:00Z'));
  assert.equal(iso(window.start), '2026-10-08T18:30:00.000Z');
  assert.equal(iso(window.end), '2026-10-09T18:29:59.999Z');
  assert.equal(iso(istCalendarDay(new Date('2026-10-08T20:00:00Z'))), '2026-10-09T00:00:00.000Z');
});

test('date filters mean whole IST days and reject nonsense instead of crashing the query', () => {
  assert.equal(iso(parseDateFilter('2026-10-09', 'start')), '2026-10-08T18:30:00.000Z');
  assert.equal(iso(parseDateFilter('2026-10-09', 'end')), '2026-10-09T18:29:59.999Z');
  assert.equal(parseDateFilter(undefined, 'start'), undefined);
  assert.equal(parseDateFilter('', 'end'), undefined);
  assert.throws(() => parseDateFilter('2026-13-45', 'start'), (error) => error.code === 'INVALID_DATE');
  assert.throws(() => parseDateFilter('garbage', 'end'), (error) => error.code === 'INVALID_DATE');
});

// ---- Attendance numbers -----------------------------------------------------------------------

test('session stats count active students, excused leave and since-deactivated attendees consistently', () => {
  const stats = buildSessionStats(['a', 'b', 'c', 'd'], [
    { studentId: 'a', status: 'PRESENT' },
    { studentId: 'b', status: 'LATE' },
    { studentId: 'c', status: 'LEAVE' },
    { studentId: 'e', status: 'ON_DUTY' }, // deactivated later but did attend
  ]);
  assert.deepEqual(stats, { totalStudents: 5, present: 3, leave: 1, absent: 1, progressPercent: 60 });
  assert.deepEqual(buildSessionStats([], []), { totalStudents: 0, present: 0, leave: 0, absent: 0, progressPercent: 0 });
});

test('one definition of "attended" is shared everywhere', () => {
  assert.deepEqual([...PRESENT_STATUSES].sort(), ['LATE', 'ON_DUTY', 'PRESENT']);
  assert.equal(isPresentStatus('ON_DUTY'), true);
  assert.equal(isPresentStatus('LEAVE'), false);
  assert.equal(isPresentStatus('ABSENT'), false);
});

test('approved leave never downgrades real attendance; on-duty may upgrade plain leave only', () => {
  assert.equal(shouldReplaceWithApproved('LEAVE', 'ON_DUTY'), true);
  assert.equal(shouldReplaceWithApproved('PRESENT', 'LEAVE'), false);
  assert.equal(shouldReplaceWithApproved('LATE', 'ON_DUTY'), false);
  assert.equal(shouldReplaceWithApproved('ABSENT', 'LEAVE'), false);
  assert.equal(shouldReplaceWithApproved('LEAVE', 'LEAVE'), false);
});

// ---- Session lifecycle ------------------------------------------------------------------------

test('a forgotten session is released once its class time is over, not while the class is still running', () => {
  const scheduled = { sessionType: 'SCHEDULED', scheduledEndAt: new Date('2026-10-09T04:45:00Z') }; // class ends 04:30, +15 grace
  assert.equal(isSessionPastNominalEnd(scheduled, new Date('2026-10-09T04:29:00Z')), false);
  assert.equal(isSessionPastNominalEnd(scheduled, new Date('2026-10-09T04:30:00Z')), true);
  const extra = { sessionType: 'EXTRA', scheduledEndAt: new Date('2026-10-09T04:45:00Z') };
  assert.equal(isSessionPastNominalEnd(extra, new Date('2026-10-09T04:44:00Z')), false);
  assert.equal(isSessionPastNominalEnd(extra, new Date('2026-10-09T04:45:00Z')), true);
  assert.equal(isSessionPastNominalEnd({ sessionType: 'SCHEDULED', scheduledEndAt: null }, new Date()), false);
});

test('only the owning faculty (or an admin) may listen to a session room', () => {
  const session = { facultyId: 'f1' };
  assert.equal(canJoinSessionRoom({ sub: 'f1', role: 'FACULTY' }, session), true);
  assert.equal(canJoinSessionRoom({ sub: 'f2', role: 'FACULTY' }, session), false);
  assert.equal(canJoinSessionRoom({ sub: 's1', role: 'STUDENT' }, session), false);
  assert.equal(canJoinSessionRoom({ sub: 'a1', role: 'ADMIN' }, session), true);
  assert.equal(canJoinSessionRoom({ sub: 'f1', role: 'FACULTY', mcp: true }, session), false);
  assert.equal(canJoinSessionRoom({ sub: 'f1', role: 'FACULTY' }, null), false);
});

// ---- Errors -----------------------------------------------------------------------------------

test('database constraint failures become 4xx answers, not 500s', () => {
  const known = (code) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });
  assert.equal(mapPrismaError(known('P2002')).status, 409);
  assert.equal(mapPrismaError(known('P2025')).status, 404);
  assert.equal(mapPrismaError(known('P2003')).status, 409);
  assert.equal(mapPrismaError(known('P2000')), null);
  assert.equal(mapPrismaError(new Error('boom')), null);
});

// ---- Rate limits (the "college Wi-Fi" problem) -------------------------------------------------

test('rate-limit keys follow the account being targeted', () => {
  assert.equal(accountKey({ path: '/student/login', body: { email: ' Asha@KGISL.edu ' }, ip: '1.1.1.1' }), '/student/login|asha@kgisl.edu');
  assert.equal(accountKey({ path: '/change-password', body: {}, auth: { sub: 'u-7' }, ip: '1.1.1.1' }), '/change-password|u-7');
  assert.equal(accountKey({ path: '/google', body: {}, ip: '9.9.9.9' }), '/google|9.9.9.9');
});

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function post(server, path, body) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.status;
}

test('wrong passwords lock one account only; a classroom signing in from one IP is never blocked', async () => {
  const app = express();
  app.use(express.json());
  app.post('/student/login', authRateLimiter, (req, res) =>
    req.body.password === 'right' ? res.json({ success: true }) : res.status(401).json({ code: 'INVALID_CREDENTIALS' })
  );
  const server = await listen(app);
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal(await post(server, '/student/login', { email: 'victim@kgisl.edu', password: 'bad' }), 401);
    }
    // The fourth try for the same account is blocked, however the e-mail is capitalised or padded.
    assert.equal(await post(server, '/student/login', { email: 'victim@kgisl.edu', password: 'bad' }), 429);
    assert.equal(await post(server, '/student/login', { email: ' VICTIM@kgisl.edu', password: 'right' }), 429);
    // Forty other students sign in successfully from the very same IP address.
    for (let student = 0; student < 40; student += 1) {
      assert.equal(await post(server, '/student/login', { email: `student${student}@kgisl.edu`, password: 'right' }), 200);
    }
  } finally {
    server.close();
  }
});

test('reset-code requests are limited per mailbox even though they always answer 200', async () => {
  const app = express();
  app.use(express.json());
  app.post('/password-reset/request', passwordResetRequestLimiter, (_req, res) => res.json({ success: true }));
  const server = await listen(app);
  try {
    assert.equal(await post(server, '/password-reset/request', { email: 'asha@kgisl.edu' }), 200);
    assert.equal(await post(server, '/password-reset/request', { email: 'asha@kgisl.edu' }), 200);
    assert.equal(await post(server, '/password-reset/request', { email: 'ASHA@kgisl.edu' }), 429);
    assert.equal(await post(server, '/password-reset/request', { email: 'ravi@kgisl.edu' }), 200);
  } finally {
    server.close();
  }
});
