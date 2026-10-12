/**
 * End-to-end tests against a real PostgreSQL and a real Redis: the HTTP API of the compiled app is exercised exactly
 * as the web and Android clients use it. They only run when RUN_INTEGRATION=1 (see `npm run test:integration`), with
 * DATABASE_URL and REDIS_URL pointing at DISPOSABLE services: the tests create their own users and sections.
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');

const enabled = process.env.RUN_INTEGRATION === '1';
const skip = enabled ? false : 'set RUN_INTEGRATION=1 with a disposable DATABASE_URL / REDIS_URL to run the integration tests';

// Loaded lazily: requiring the app connects to Redis.
let app;
let server;
let baseUrl;
let prisma;
let redis;
let bcrypt;
let services;

const run = `it${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const password = 'Initial#Pass1';
const gpsAtRoom = { lat: 11.0843583, lng: 76.9975306, accuracy: 10 };
const gpsFarAway = { lat: 11.1043583, lng: 76.9975306, accuracy: 10 }; // ~2.2 km north

const ctx = { users: {}, tokens: {} };

async function api(method, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function login(role, email, pass = password) {
  const path = role === 'STUDENT' ? '/auth/student/login' : role === 'FACULTY' ? '/auth/faculty/login' : '/auth/admin/login';
  const result = await api('POST', path, { body: { email, password: pass } });
  assert.equal(result.status, 200, `login ${email}: ${JSON.stringify(result.body)}`);
  return result.body.data ?? result.body;
}

const qrBody = (payload, gps = gpsAtRoom, deviceId = 'device-a') => ({
  deviceId,
  gps,
  qr: { sessionId: payload.sessionId, token: payload.token, issuedAt: payload.issuedAt, expiresAt: payload.expiresAt, nonce: payload.nonce, signature: payload.signature },
});

async function makeStudent(index, { mustChangePassword = false } = {}) {
  return prisma.student.create({
    data: {
      name: `Student ${index}`,
      rollNo: `${run}-R${index}`.toUpperCase(),
      regNo: `${run}-G${index}`.toUpperCase(),
      email: `${run}.s${index}@kgisl.test`,
      passwordHash: await bcrypt.hash(password, 4),
      mustChangePassword,
      batchId: ctx.batch.id,
    },
  });
}

before(async () => {
  if (!enabled) return;
  ({ createApp: app } = require('../dist/app.js'));
  ({ prisma } = require('../dist/config/prisma.js'));
  ({ redis } = require('../dist/config/redis.js'));
  bcrypt = require('bcryptjs');
  services = {
    qr: require('../dist/services/qr.service.js'),
    session: require('../dist/services/session.service.js'),
  };

  server = http.createServer(app());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const hash = await bcrypt.hash(password, 4);
  ctx.faculty = await prisma.faculty.create({ data: { name: `Faculty ${run}`, email: `${run}.f@kgisl.test`, passwordHash: hash } });
  ctx.otherFaculty = await prisma.faculty.create({ data: { name: `Other ${run}`, email: `${run}.o@kgisl.test`, passwordHash: hash } });
  ctx.admin = await prisma.admin.create({ data: { name: `Admin ${run}`, email: `${run}.a@kgisl.test`, passwordHash: hash } });
  ctx.batch = await prisma.batch.create({ data: { name: `${run}-section`, mentorId: ctx.faculty.id } });
  ctx.subject = await prisma.subject.create({ data: { name: `Subject ${run}`, code: run.toUpperCase() } });
  ctx.room = await prisma.room.create({ data: { name: `${run}-room`, latitude: gpsAtRoom.lat, longitude: gpsAtRoom.lng, geofenceRadiusM: 150 } });
  ctx.beaconId = 1000 + Math.floor(Math.random() * 60000);
  await prisma.classroomBeacon.create({ data: { beaconId: ctx.beaconId, name: `${run} beacon`, roomId: ctx.room.id } });

  ctx.students = [];
  for (let index = 1; index <= 4; index += 1) ctx.students.push(await makeStudent(index));
});

after(async () => {
  if (!enabled) return;
  // Stop every timer the tests started, then release the connections so the process can exit.
  await services.session.endActiveSessionsForFaculty(ctx.faculty.id).catch(() => undefined);
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  redis.disconnect();
});

test('sign-in works for each role and a wrong password is rejected', { skip }, async () => {
  ctx.tokens.faculty = (await login('FACULTY', ctx.faculty.email)).token;
  ctx.tokens.otherFaculty = (await login('FACULTY', ctx.otherFaculty.email)).token;
  ctx.tokens.admin = (await login('ADMIN', ctx.admin.email)).token;
  ctx.tokens.students = [];
  for (const student of ctx.students) ctx.tokens.students.push((await login('STUDENT', student.email)).token);

  const wrong = await api('POST', '/auth/student/login', { body: { email: ctx.students[0].email, password: 'not-the-password' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');
});

test('role boundaries: students cannot use faculty or admin routes', { skip }, async () => {
  assert.equal((await api('GET', '/sessions/active/mine', { token: ctx.tokens.students[0] })).status, 401);
  assert.equal((await api('GET', '/history/audit', { token: ctx.tokens.faculty })).status, 401);
  assert.equal((await api('GET', '/faculty', { token: ctx.tokens.students[0] })).status, 401);
  assert.equal((await api('GET', '/students/me/attendance')).status, 401);
});

test('a session starts with a first QR, and the QR flow accepts, rejects and limits scans', { skip }, async () => {
  const started = await api('POST', '/sessions/extra', {
    token: ctx.tokens.faculty,
    body: { subjectId: ctx.subject.id, roomId: ctx.room.id, batchId: ctx.batch.id, durationMinutes: 30, reason: 'integration test' },
  });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  ctx.sessionId = started.body.data.sessionId;
  assert.match(started.body.data.initialQr.qrImageDataUrl, /^data:image\/png;base64,/);

  // Only one live session per faculty member.
  const second = await api('POST', '/sessions/extra', {
    token: ctx.tokens.faculty,
    body: { subjectId: ctx.subject.id, roomId: ctx.room.id, batchId: ctx.batch.id, durationMinutes: 15, reason: 'second one' },
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'SESSION_ALREADY_ACTIVE');

  const { payload } = await services.qr.generateNewQr(ctx.sessionId);

  // A student inside the room is marked present; the same student cannot be counted twice.
  const accepted = await api('POST', '/scan', { token: ctx.tokens.students[0], body: qrBody(payload) });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  assert.equal(accepted.body.data.status, 'PRESENT');
  assert.equal(accepted.body.data.method, 'QR');
  const repeated = await api('POST', '/scan', { token: ctx.tokens.students[0], body: qrBody(payload) });
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.code, 'ATTENDANCE_ALREADY_MARKED');

  // Tampered signature.
  const forged = await api('POST', '/scan', { token: ctx.tokens.students[1], body: qrBody({ ...payload, signature: `${payload.signature.slice(0, -2)}xx` }) });
  assert.equal(forged.status, 401);
  assert.equal(forged.body.code, 'INVALID_QR_SIGNATURE');

  // Outside the classroom radius.
  const far = await api('POST', '/scan', { token: ctx.tokens.students[1], body: qrBody(payload, gpsFarAway) });
  assert.equal(far.status, 403);
  assert.equal(far.body.code, 'OUTSIDE_ALLOWED_LOCATION');

  // Bad GPS accuracy.
  const vague = await api('POST', '/scan', { token: ctx.tokens.students[1], body: qrBody(payload, { ...gpsAtRoom, accuracy: 400 }) });
  assert.equal(vague.status, 400);
  assert.equal(vague.body.code, 'GPS_ACCURACY_TOO_LOW');
});

test('a QR that was just replaced is still accepted during the grace window, an older one is not', { skip }, async () => {
  const { payload: first } = await services.qr.generateNewQr(ctx.sessionId);
  const { payload: second } = await services.qr.generateNewQr(ctx.sessionId); // replaces `first`
  const { payload: third } = await services.qr.generateNewQr(ctx.sessionId); // replaces `second`; `first` is now two rotations old

  const stale = await api('POST', '/scan', { token: ctx.tokens.students[1], body: qrBody(first) });
  assert.equal(stale.status, 410, JSON.stringify(stale.body));
  assert.equal(stale.body.code, 'QR_EXPIRED');

  const graceful = await api('POST', '/scan', { token: ctx.tokens.students[1], body: qrBody(second) });
  assert.equal(graceful.status, 201, JSON.stringify(graceful.body));

  const current = await api('POST', '/scan', { token: ctx.tokens.students[2], body: qrBody(third) });
  assert.equal(current.status, 201, JSON.stringify(current.body));
});

test('device binding: the second phone of a student is refused', { skip }, async () => {
  const { payload } = await services.qr.generateNewQr(ctx.sessionId);
  // student 0 is already present and bound to "device-a"; use student 3 to bind, then try another device.
  const bound = await api('POST', '/scan', { token: ctx.tokens.students[3], body: qrBody(payload, gpsAtRoom, 'phone-one') });
  assert.equal(bound.status, 201, JSON.stringify(bound.body));
  const other = await api('POST', '/scan', { token: ctx.tokens.students[3], body: qrBody(payload, gpsAtRoom, 'phone-two') });
  assert.equal(other.status, 403);
  assert.equal(other.body.code, 'DEVICE_NOT_AUTHORIZED');
  const student = await prisma.student.findUnique({ where: { id: ctx.students[3].id } });
  assert.equal(student.deviceId, 'phone-one');
});

test('BLE beacon: faculty issues a signed packet and a student marks attendance with it', { skip }, async () => {
  const lateStudent = await makeStudent(9);
  const token = (await login('STUDENT', lateStudent.email)).token;

  const issued = await api('POST', `/sessions/${ctx.sessionId}/beacon-packet`, { token: ctx.tokens.faculty, body: { beaconId: ctx.beaconId } });
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const packet = issued.body.data.packet;
  assert.equal(packet.length, 28);

  // Another faculty member cannot issue packets for this session.
  const foreign = await api('POST', `/sessions/${ctx.sessionId}/beacon-packet`, { token: ctx.tokens.otherFaculty, body: { beaconId: ctx.beaconId } });
  assert.equal(foreign.status, 403);

  const weak = await api('POST', '/scan/beacon', { token, body: { packet, rssi: -120, deviceId: 'beacon-phone', gps: gpsAtRoom } });
  assert.equal(weak.status, 403);
  assert.equal(weak.body.code, 'BEACON_SIGNAL_TOO_WEAK');

  const marked = await api('POST', '/scan/beacon', { token, body: { packet, rssi: -60, deviceId: 'beacon-phone', gps: gpsAtRoom } });
  assert.equal(marked.status, 201, JSON.stringify(marked.body));
  assert.equal(marked.body.data.method, 'BEACON');

  const tampered = `${packet.slice(0, 20)}AAAAAAAA`;
  const forged = await api('POST', '/scan/beacon', { token, body: { packet: tampered, rssi: -60, deviceId: 'beacon-phone', gps: gpsAtRoom } });
  assert.equal(forged.status, 410);
});

test('faculty overrides a mark with a reason and the class list follows', { skip }, async () => {
  const attended = (list) => list.body.data.students.filter((student) => ['PRESENT', 'LATE', 'ON_DUTY'].includes(student.attendanceStatus)).length;
  const listing = await api('GET', `/history/${ctx.sessionId}`, { token: ctx.tokens.faculty });
  assert.equal(listing.status, 200, JSON.stringify(listing.body));
  const before = attended(listing);
  assert.ok(before >= 4);

  const absent = await api('PATCH', `/sessions/${ctx.sessionId}/attendance`, {
    token: ctx.tokens.faculty,
    body: { rollNo: ctx.students[0].rollNo, status: 'ABSENT', reason: 'left the class early' },
  });
  assert.equal(absent.status, 200, JSON.stringify(absent.body));
  assert.equal(absent.body.data.previousStatus, 'PRESENT');

  assert.equal(attended(await api('GET', `/history/${ctx.sessionId}`, { token: ctx.tokens.faculty })), before - 1);

  const denied = await api('PATCH', `/sessions/${ctx.sessionId}/attendance`, {
    token: ctx.tokens.otherFaculty,
    body: { rollNo: ctx.students[0].rollNo, status: 'PRESENT', reason: 'not my class' },
  });
  assert.equal(denied.status, 403);
});

test('pausing a session stops scans; ending it keeps the records', { skip }, async () => {
  const { payload } = await services.qr.generateNewQr(ctx.sessionId);
  const paused = await api('POST', `/sessions/${ctx.sessionId}/pause`, { token: ctx.tokens.faculty });
  assert.equal(paused.status, 200);
  const refused = await api('POST', '/scan', { token: ctx.tokens.students[0], body: qrBody(payload) });
  assert.equal(refused.status, 410, JSON.stringify(refused.body));

  const resumed = await api('POST', `/sessions/${ctx.sessionId}/resume`, { token: ctx.tokens.faculty });
  assert.equal(resumed.status, 200);
  assert.match(resumed.body.data.initialQr.qrImageDataUrl, /^data:image\/png;base64,/);

  const ended = await api('POST', `/sessions/${ctx.sessionId}/end`, { token: ctx.tokens.faculty });
  assert.equal(ended.status, 200);
  assert.equal(ended.body.data.status, 'ENDED');

  const records = await prisma.attendanceRecord.count({ where: { sessionId: ctx.sessionId } });
  assert.ok(records >= 4);
});

test('a student reports a missed mark and the faculty member approves it', { skip }, async () => {
  const missed = await makeStudent(7);
  const token = (await login('STUDENT', missed.email)).token;

  const live = await api('POST', '/attendance-corrections', { token, body: { sessionId: ctx.sessionId, reason: 'Was in class, phone battery died' } });
  assert.equal(live.status, 201, JSON.stringify(live.body));
  const requestId = live.body.data.id;

  const again = await api('POST', '/attendance-corrections', { token, body: { sessionId: ctx.sessionId, reason: 'Sending the same request again' } });
  assert.equal(again.status, 409);

  const review = await api('PATCH', `/attendance-corrections/${requestId}/review`, { token: ctx.tokens.faculty, body: { status: 'APPROVED', reviewNote: 'Verified with the class' } });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  const record = await prisma.attendanceRecord.findUnique({ where: { uq_student_session: { studentId: missed.id, sessionId: ctx.sessionId } } });
  assert.equal(record.status, 'PRESENT');
});

test('approved leave is applied to classes that start after the approval', { skip }, async () => {
  const onLeave = await makeStudent(8);
  const token = (await login('STUDENT', onLeave.email)).token;
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

  const request = await api('POST', '/leave-requests', { token, body: { type: 'LEAVE', fromDate: today, toDate: today, reason: 'Medical appointment' } });
  assert.equal(request.status, 201, JSON.stringify(request.body));
  const approved = await api('PATCH', `/leave-requests/${request.body.data.id}/review`, { token: ctx.tokens.faculty, body: { status: 'APPROVED', reviewNote: 'Approved' } });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));

  // Re-open the period as a new extra class: the student on leave is excused automatically.
  const next = await api('POST', '/sessions/extra', {
    token: ctx.tokens.faculty,
    body: { subjectId: ctx.subject.id, roomId: ctx.room.id, batchId: ctx.batch.id, durationMinutes: 15, reason: 'leave test' },
  });
  assert.equal(next.status, 201, JSON.stringify(next.body));
  const record = await prisma.attendanceRecord.findUnique({ where: { uq_student_session: { studentId: onLeave.id, sessionId: next.body.data.sessionId } } });
  assert.equal(record?.status, 'LEAVE');

  // "Wrong class" undo removes a session nobody marked (the automatic leave rows do not count as marks).
  const cancelled = await api('POST', `/sessions/${next.body.data.sessionId}/cancel`, { token: ctx.tokens.faculty });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(await prisma.attendanceSession.count({ where: { sessionId: next.body.data.sessionId } }), 0);
});

test('dashboard summary and audit trail are served by the database', { skip }, async () => {
  const summary = await api('GET', '/history/summary', { token: ctx.tokens.faculty });
  assert.equal(summary.status, 200, JSON.stringify(summary.body));
  assert.ok(summary.body.data.completedSessions >= 1);
  assert.ok(summary.body.data.subjects.some((row) => row.code === run.toUpperCase()));
  assert.ok(summary.body.data.attendancePercentage <= 100);

  const history = await api('GET', `/history?batchId=${ctx.batch.id}&limit=5`, { token: ctx.tokens.faculty });
  assert.equal(history.status, 200);
  assert.ok(history.body.data.length >= 1);

  const audit = await api('GET', '/history/audit?group=scans&limit=3', { token: ctx.tokens.admin });
  assert.equal(audit.status, 200, JSON.stringify(audit.body));
  assert.ok(audit.body.data.items.length > 0);
  assert.ok(audit.body.data.items.every((row) => /SCAN/.test(row.action)));

  const report = await api('GET', `/history/report?batchId=${ctx.batch.id}`, { token: ctx.tokens.faculty });
  assert.equal(report.status, 200);
  assert.ok(report.body.data.students.length >= 4);
  const outsider = await api('GET', `/history/report?batchId=${ctx.batch.id}`, { token: ctx.tokens.otherFaculty });
  assert.equal(outsider.status, 403);
});

test('refresh tokens rotate once; replaying an old one signs the whole login out', { skip }, async () => {
  const first = await login('STUDENT', ctx.students[0].email);
  const rotated = await api('POST', '/auth/refresh', { body: { refreshToken: first.refreshToken } });
  assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
  assert.notEqual(rotated.body.data.refreshToken, first.refreshToken);

  // A second tab presenting the same token within seconds gets the same pair back (not a logout).
  const sibling = await api('POST', '/auth/refresh', { body: { refreshToken: first.refreshToken } });
  assert.equal(sibling.status, 200);
  assert.equal(sibling.body.data.refreshToken, rotated.body.data.refreshToken);

  // Once the grace copy is gone the same token is a replay: the family is revoked.
  const { jti } = JSON.parse(Buffer.from(first.refreshToken.split('.')[1], 'base64url').toString());
  await redis.del(`attendance:rtgrace:${jti}`);
  const replay = await api('POST', '/auth/refresh', { body: { refreshToken: first.refreshToken } });
  assert.equal(replay.status, 401);
  const afterRevoke = await api('POST', '/auth/refresh', { body: { refreshToken: rotated.body.data.refreshToken } });
  assert.equal(afterRevoke.status, 401);
});

test('an account with an initial password can only change it', { skip }, async () => {
  const fresh = await makeStudent(11, { mustChangePassword: true });
  const session = await login('STUDENT', fresh.email);
  const blocked = await api('GET', '/students/me/attendance', { token: session.token });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const weak = await api('POST', '/auth/change-password', { token: session.token, body: { currentPassword: password, newPassword: 'short' } });
  assert.equal(weak.status, 422);
  const changed = await api('POST', '/auth/change-password', { token: session.token, body: { currentPassword: password, newPassword: 'Brand-New-Secret9' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const allowed = await api('GET', '/students/me/attendance', { token: changed.body.data.token });
  assert.equal(allowed.status, 200);
});

test('an administrator can issue a one-time reset code for a student', { skip }, async () => {
  const student = ctx.students[1];
  const issued = await api('POST', '/auth/password-reset/code', { token: ctx.tokens.admin, body: { email: student.email, role: 'STUDENT' } });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.match(issued.body.data.code, /^\d{6}$/);

  const wrong = await api('POST', '/auth/password-reset/confirm', { body: { email: student.email, role: 'STUDENT', code: '000000', newPassword: 'Campus-2026-Fresh1' } });
  assert.equal(wrong.status, 400);

  const done = await api('POST', '/auth/password-reset/confirm', { body: { email: student.email, role: 'STUDENT', code: issued.body.data.code, newPassword: 'Campus-2026-Fresh1' } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const reuse = await api('POST', '/auth/password-reset/confirm', { body: { email: student.email, role: 'STUDENT', code: issued.body.data.code, newPassword: 'Campus-2026-Fresh2' } });
  assert.equal(reuse.status, 400);

  assert.equal((await api('POST', '/auth/student/login', { body: { email: student.email, password } })).status, 401);
  assert.equal((await api('POST', '/auth/student/login', { body: { email: student.email, password: 'Campus-2026-Fresh1' } })).status, 200);
});
