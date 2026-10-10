import { prisma } from '../config/prisma';
import { redis, qrRedisKey } from '../config/redis';
import { env } from '../config/env';
import { generateNewQr } from './qr.service';
import { broadcastQrUpdate, broadcastSessionEnded, broadcastSessionPaused } from '../websocket/socket';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { revokeBeaconToken } from './beaconToken.service';
import { applyApprovedLeavesToSession } from './leave.service';
import { COMPLETED_SESSION_STATUSES, LIVE_SESSION_STATUSES, PRESENT_STATUSES, buildSessionStats } from '../utils/attendanceStatus';
import { istCalendarDay, istDayWindow, istParts, istTimeOnDay, toMinutes } from '../utils/time';
import { PERIOD_GRACE_MINUTES, PERIOD_GRACE_MS, isSessionPastNominalEnd } from '../utils/sessionWindow';

// In-memory registry of active refresh timers, keyed by sessionId.
// (For a multi-instance deployment, promote this to a Redis-backed leader-election
//  or a dedicated worker process so only one instance owns the timer per session.)
const activeTimers = new Map<string, NodeJS.Timeout>();
const autoEndTimers = new Map<string, NodeJS.Timeout>();

/** A mistakenly started session can be cancelled (and disappear from reports) only inside this window. */
const CANCEL_WINDOW_MS = 15 * 60_000;

export interface StartSessionInput {
  facultyId: string;
  allocationId: string;
  subjectId: string;
  roomId: string;
  batchId: string;
}

/**
 * If the faculty member forgot to end the previous period, finish it automatically once its class time
 * is over instead of blocking them from opening the next period with "end your current session".
 */
async function releaseStaleSession(facultyId: string): Promise<void> {
  const open = await prisma.attendanceSession.findFirst({
    where: { facultyId, status: { in: LIVE_SESSION_STATUSES } },
  });
  if (open && isSessionPastNominalEnd(open)) {
    await endSession(open.sessionId, facultyId);
  }
}

export async function startSession(input: StartSessionInput) {
  const allocation = await prisma.timetableAllocation.findFirst({
    where: { id: input.allocationId, facultyId: input.facultyId },
  });
  if (!allocation || allocation.subjectId !== input.subjectId || allocation.roomId !== input.roomId || allocation.batchId !== input.batchId) {
    throw Errors.ALLOCATION_NOT_FOUND();
  }

  const now = new Date();
  const ist = istParts(now);
  if (allocation.dayOfWeek !== ist.dayOfWeek) throw Errors.WRONG_TIMETABLE_DAY();
  if (
    ist.minutes < toMinutes(allocation.startTime) - PERIOD_GRACE_MINUTES ||
    ist.minutes > toMinutes(allocation.endTime) + PERIOD_GRACE_MINUTES
  ) {
    throw Errors.OUTSIDE_PERIOD_TIME();
  }

  await releaseStaleSession(input.facultyId);
  const active = await prisma.attendanceSession.findFirst({ where: { facultyId: input.facultyId, status: { in: LIVE_SESSION_STATUSES } } });
  if (active) throw Errors.SESSION_ALREADY_ACTIVE();

  const scheduledEndAt = new Date(istTimeOnDay(allocation.endTime, now).getTime() + PERIOD_GRACE_MS);

  // Ending and starting the same period again (accidental End, browser crash, ...) must continue the
  // same class. Creating a second session would count one class twice and halve everyone's percentage.
  const today = istDayWindow(istCalendarDay(now)).start;
  const reopenable = await prisma.attendanceSession.findFirst({
    where: {
      facultyId: input.facultyId,
      allocationId: allocation.id,
      sessionType: 'SCHEDULED',
      status: { in: COMPLETED_SESSION_STATUSES },
      startedAt: { gte: today },
    },
    orderBy: { startedAt: 'desc' },
  });

  let session: Awaited<ReturnType<typeof prisma.attendanceSession.create>>;
  if (reopenable) {
    session = await prisma.attendanceSession.update({
      where: { sessionId: reopenable.sessionId },
      data: { status: 'ACTIVE', endedAt: null, scheduledEndAt, currentQrTokenHash: null, currentQrExpiry: null },
    });
  } else {
    session = await prisma.attendanceSession.create({
      data: {
        facultyId: input.facultyId,
        subjectId: input.subjectId,
        roomId: input.roomId,
        batchId: input.batchId,
        allocationId: allocation.id,
        status: 'ACTIVE',
        scheduledEndAt,
        sessionType: 'SCHEDULED',
      },
    });
    await applyApprovedLeavesToSession(session).catch((err) =>
      logger.error('[session] could not apply approved leave', { sessionId: session.sessionId, error: err.message })
    );
  }

  // Return the first QR with the HTTP response as well as broadcasting it. The
  // faculty client cannot join the Socket.IO room until it learns the new
  // sessionId, so a websocket-only first QR is inherently racy and can leave
  // the dashboard waiting for the next refresh interval.
  const initialQr = await tickAndBroadcast(session.sessionId);
  scheduleRefresh(session.sessionId);
  scheduleAutoEnd(session.sessionId, session.scheduledEndAt);

  return { ...session, initialQr };
}

export async function startExtraSession(input: Omit<StartSessionInput, 'allocationId'> & { durationMinutes: number; reason: string }) {
  await releaseStaleSession(input.facultyId);
  const active = await prisma.attendanceSession.findFirst({ where: { facultyId: input.facultyId, status: { in: LIVE_SESSION_STATUSES } } });
  if (active) throw Errors.SESSION_ALREADY_ACTIVE();
  const [subject, room, batch] = await Promise.all([
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
    prisma.room.findUnique({ where: { id: input.roomId } }),
    prisma.batch.findUnique({ where: { id: input.batchId } }),
  ]);
  if (!subject || !room || !batch) throw Errors.SESSION_NOT_FOUND();
  const scheduledEndAt = new Date(Date.now() + input.durationMinutes * 60_000);
  const session = await prisma.attendanceSession.create({
    data: { facultyId: input.facultyId, subjectId: input.subjectId, roomId: input.roomId, batchId: input.batchId, status: 'ACTIVE', scheduledEndAt, sessionType: 'EXTRA', notes: input.reason },
  });
  await applyApprovedLeavesToSession(session).catch((err) =>
    logger.error('[session] could not apply approved leave', { sessionId: session.sessionId, error: err.message })
  );
  const initialQr = await tickAndBroadcast(session.sessionId);
  scheduleRefresh(session.sessionId);
  scheduleAutoEnd(session.sessionId, scheduledEndAt);
  return { ...session, initialQr };
}

export async function getActiveSession(facultyId: string) {
  return prisma.attendanceSession.findFirst({
    where: { facultyId, status: { in: LIVE_SESSION_STATUSES } },
    include: { subject: true, batch: true, room: true },
    orderBy: { startedAt: 'desc' },
  });
}

export async function pauseSession(sessionId: string, facultyId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId || session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();

  clearRefresh(sessionId);
  await Promise.all([redis.del(qrRedisKey(sessionId)), revokeBeaconToken(sessionId)]);
  await prisma.attendanceQrHistory.updateMany({
    where: { sessionId, isExpired: false },
    data: { isExpired: true, revoked: true },
  });
  const updated = await prisma.attendanceSession.update({
    where: { sessionId },
    data: { status: 'PAUSED', currentQrTokenHash: null, currentQrExpiry: null },
  });
  broadcastSessionPaused(sessionId);
  return updated;
}

export async function resumeSession(sessionId: string, facultyId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId || session.status !== 'PAUSED') throw Errors.SESSION_NOT_ACTIVE();

  const updated = await prisma.attendanceSession.update({
    where: { sessionId },
    data: { status: 'ACTIVE' },
  });
  const initialQr = await tickAndBroadcast(sessionId);
  scheduleRefresh(sessionId);
  return { ...updated, initialQr };
}

function scheduleRefresh(sessionId: string) {
  clearRefresh(sessionId);
  const timer = setInterval(() => {
    tickAndBroadcast(sessionId).catch((err) =>
      logger.error('[session] refresh tick failed', { sessionId, error: err.message })
    );
  }, env.QR_REFRESH_INTERVAL_SECONDS * 1000);
  activeTimers.set(sessionId, timer);
}

function clearRefresh(sessionId: string) {
  const existing = activeTimers.get(sessionId);
  if (existing) {
    clearInterval(existing);
    activeTimers.delete(sessionId);
  }
}

async function tickAndBroadcast(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session || session.status !== 'ACTIVE') {
    clearRefresh(sessionId);
    return null;
  }

  const { payload, qrImageDataUrl } = await generateNewQr(sessionId);
  const stats = await getSessionStats(sessionId);

  const update = {
    qrImageDataUrl,
    // Note: we only ever emit the payload fields the client needs to render the
    // image + know when to expect the next one — the server drives the countdown.
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    refreshIntervalSeconds: env.QR_REFRESH_INTERVAL_SECONDS,
    stats,
  };
  broadcastQrUpdate(sessionId, update);
  return update;
}

function clearAutoEnd(sessionId: string) {
  const existing = autoEndTimers.get(sessionId);
  if (existing) clearTimeout(existing);
  autoEndTimers.delete(sessionId);
}

function scheduleAutoEnd(sessionId: string, endAt: Date | null) {
  clearAutoEnd(sessionId);
  if (!endAt) return;
  const delay = endAt.getTime() - Date.now();
  if (delay <= 0) {
    autoEndSession(sessionId).catch((err) => logger.error('[session] auto-end failed', { sessionId, error: err.message }));
    return;
  }
  const timer = setTimeout(() => {
    autoEndSession(sessionId).catch((err) => logger.error('[session] auto-end failed', { sessionId, error: err.message }));
  }, Math.min(delay, 2_147_483_647));
  autoEndTimers.set(sessionId, timer);
}

async function autoEndSession(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session || !LIVE_SESSION_STATUSES.includes(session.status)) return;
  // setTimeout is capped (~24.8 days) and a session may have been re-opened with a later end:
  // only expire it once its stored end has really passed.
  if (session.scheduledEndAt && session.scheduledEndAt.getTime() > Date.now() + 1_000) {
    scheduleAutoEnd(sessionId, session.scheduledEndAt);
    return;
  }
  clearRefresh(sessionId);
  clearAutoEnd(sessionId);
  await Promise.all([redis.del(qrRedisKey(sessionId)), revokeBeaconToken(sessionId)]);
  await prisma.$transaction([
    prisma.attendanceSession.update({ where: { sessionId }, data: { status: 'EXPIRED', endedAt: new Date(), currentQrTokenHash: null, currentQrExpiry: null } }),
    prisma.attendanceQrHistory.updateMany({ where: { sessionId, isExpired: false }, data: { isExpired: true, revoked: true } }),
  ]);
  broadcastSessionEnded(sessionId);
}

export async function endSession(sessionId: string, facultyId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId) throw Errors.SESSION_ACCESS_DENIED();
  // Ending an already finished session is a no-op: it must not rewrite the end time or turn the
  // auto-expired state of a past class into "ended" a second time.
  if (!LIVE_SESSION_STATUSES.includes(session.status)) return session;

  clearRefresh(sessionId);
  clearAutoEnd(sessionId);

  const updated = await prisma.attendanceSession.update({
    where: { sessionId },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
      currentQrTokenHash: null,
      currentQrExpiry: null,
    },
  });

  // Immediately invalidate any lingering token.
  await Promise.all([redis.del(qrRedisKey(sessionId)), revokeBeaconToken(sessionId)]);
  await prisma.attendanceQrHistory.updateMany({
    where: { sessionId, isExpired: false },
    data: { isExpired: true, revoked: true },
  });

  broadcastSessionEnded(sessionId);
  return updated;
}

/**
 * "Wrong class" undo. A session that nobody has marked yet is deleted outright, so an accidental
 * start never appears in reports as a class that was held with 100% absentees.
 */
export async function cancelSession(sessionId: string, facultyId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId) throw Errors.SESSION_ACCESS_DENIED();
  if (!LIVE_SESSION_STATUSES.includes(session.status)) throw Errors.SESSION_NOT_ACTIVE();
  if (Date.now() - session.startedAt.getTime() > CANCEL_WINDOW_MS) throw Errors.SESSION_CANCEL_NOT_ALLOWED();

  // Leave/OD records added automatically at start do not count as real attendance.
  const realRecords = await prisma.attendanceRecord.count({
    where: {
      sessionId,
      OR: [{ locationVerificationStatus: null }, { locationVerificationStatus: { not: 'APPROVED_REQUEST' } }],
    },
  });
  if (realRecords > 0) throw Errors.SESSION_CANCEL_NOT_ALLOWED();

  clearRefresh(sessionId);
  clearAutoEnd(sessionId);
  await Promise.all([redis.del(qrRedisKey(sessionId)), revokeBeaconToken(sessionId)]);
  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { sessionId } }),
    prisma.attendanceCorrectionRequest.deleteMany({ where: { sessionId } }),
    prisma.attendanceQrHistory.deleteMany({ where: { sessionId } }),
    prisma.attendanceSession.delete({ where: { sessionId } }),
  ]);
  broadcastSessionEnded(sessionId);
}

/** Used when an account is deactivated so its running class does not stay open on a dead login. */
export async function endActiveSessionsForFaculty(facultyId: string): Promise<void> {
  const open = await prisma.attendanceSession.findMany({
    where: { facultyId, status: { in: LIVE_SESSION_STATUSES } },
    select: { sessionId: true },
  });
  for (const { sessionId } of open) {
    await endSession(sessionId, facultyId).catch((err) =>
      logger.error('[session] could not end session of deactivated faculty', { sessionId, error: err.message })
    );
  }
}

export async function getSessionStats(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId }, select: { batchId: true } });
  if (!session) throw Errors.SESSION_NOT_FOUND();

  const [roster, records] = await Promise.all([
    prisma.student.findMany({ where: { batchId: session.batchId, isActive: true, archivedAt: null }, select: { id: true } }),
    prisma.attendanceRecord.findMany({
      where: { sessionId, status: { in: [...PRESENT_STATUSES, 'LEAVE'] } },
      select: { studentId: true, status: true },
    }),
  ]);
  return buildSessionStats(roster.map((student) => student.id), records);
}

/**
 * Minimal, non-sensitive lookup used by the student scanning client after it
 * decodes a QR: it only knows the sessionId at that point, and needs the
 * batch/subject to send back as claims for the validation pipeline to check.
 * Deliberately excludes anything the QR spec says must never be exposed
 * (tokens, attendance counts, student data).
 */
export async function getSessionPublicInfo(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId },
    include: { subject: true, batch: true, room: true },
  });
  if (!session || session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();

  return {
    sessionId: session.sessionId,
    batchId: session.batchId,
    subjectId: session.subjectId,
    subjectName: session.subject.name,
    roomName: session.room.name,
  };
}

/** Called once at process startup to resume timers for any sessions left ACTIVE (e.g. after a restart). */
export async function resumeActiveSessions() {
  const active = await prisma.attendanceSession.findMany({ where: { status: { in: LIVE_SESSION_STATUSES } } });
  for (const s of active) {
    if (s.status === 'ACTIVE') scheduleRefresh(s.sessionId);
    scheduleAutoEnd(s.sessionId, s.scheduledEndAt);
    logger.info('[session] resumed refresh timer', { sessionId: s.sessionId });
  }
}
