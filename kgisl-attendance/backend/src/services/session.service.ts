import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { generateNewQr, clearSessionQr } from './qr.service';
import { broadcastQrUpdate, broadcastSessionEnded, broadcastSessionPaused } from '../websocket/socket';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { revokeBeaconToken } from './beaconToken.service';
import { applyApprovedLeavesToSession } from './leave.service';
import { COMPLETED_SESSION_STATUSES, LIVE_SESSION_STATUSES } from '../utils/attendanceStatus';
import { istCalendarDay, istDayWindow, istParts, istTimeOnDay, toMinutes } from '../utils/time';
import { PERIOD_GRACE_MINUTES, PERIOD_GRACE_MS, isSessionPastNominalEnd } from '../utils/sessionWindow';

// In-memory timers, keyed by sessionId. This server runs as a single process; a second instance would need a
// shared scheduler (see README, "Scaling").
const refreshTimers = new Map<string, NodeJS.Timeout>();
const autoEndTimers = new Map<string, NodeJS.Timeout>();

/** A mistakenly started session can be cancelled (and disappear from reports) only inside this window. */
const CANCEL_WINDOW_MS = 15 * 60_000;

interface StartSessionInput {
  facultyId: string;
  allocationId: string;
  subjectId: string;
  roomId: string;
  batchId: string;
}

async function findLiveSession(facultyId: string) {
  return prisma.attendanceSession.findFirst({ where: { facultyId, status: { in: LIVE_SESSION_STATUSES } } });
}

/**
 * If the faculty member forgot to end the previous period, finish it automatically once its class time
 * is over instead of blocking them from opening the next period with "end your current session".
 */
async function releaseStaleSession(facultyId: string): Promise<void> {
  const open = await findLiveSession(facultyId);
  if (open && isSessionPastNominalEnd(open)) await endSession(open.sessionId, facultyId);
}

async function beginLiveSession(session: { sessionId: string; scheduledEndAt: Date | null }) {
  // The first QR travels with the HTTP response as well as the socket: the dashboard cannot join the session room
  // before it knows the session id, so a socket-only first QR would leave it waiting for the next rotation.
  const initialQr = await tickAndBroadcast(session.sessionId);
  scheduleRefresh(session.sessionId);
  scheduleAutoEnd(session.sessionId, session.scheduledEndAt);
  return initialQr;
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
  if (await findLiveSession(input.facultyId)) throw Errors.SESSION_ALREADY_ACTIVE();

  const scheduledEndAt = new Date(istTimeOnDay(allocation.endTime, now).getTime() + PERIOD_GRACE_MS);

  // Ending and starting the same period again (accidental End, browser crash, ...) must continue the same class.
  // Creating a second session would count one class twice and halve everyone's percentage.
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
      data: { status: 'ACTIVE', endedAt: null, scheduledEndAt },
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

  return { ...session, initialQr: await beginLiveSession(session) };
}

/** An extra class outside the timetable: any subject/room/section, for a fixed number of minutes. */
export async function startExtraSession(
  input: Omit<StartSessionInput, 'allocationId'> & { durationMinutes: number; reason: string }
) {
  await releaseStaleSession(input.facultyId);
  if (await findLiveSession(input.facultyId)) throw Errors.SESSION_ALREADY_ACTIVE();

  const [subject, room, batch] = await Promise.all([
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
    prisma.room.findUnique({ where: { id: input.roomId } }),
    prisma.batch.findUnique({ where: { id: input.batchId } }),
  ]);
  if (!subject || !room || !batch) throw Errors.SESSION_NOT_FOUND();
  if (batch.lifecycle !== 'ACTIVE') throw Errors.BATCH_NOT_ACTIVE();

  const scheduledEndAt = new Date(Date.now() + input.durationMinutes * 60_000);
  const session = await prisma.attendanceSession.create({
    data: {
      facultyId: input.facultyId,
      subjectId: input.subjectId,
      roomId: input.roomId,
      batchId: input.batchId,
      status: 'ACTIVE',
      scheduledEndAt,
      sessionType: 'EXTRA',
      notes: input.reason,
    },
  });
  await applyApprovedLeavesToSession(session).catch((err) =>
    logger.error('[session] could not apply approved leave', { sessionId: session.sessionId, error: err.message })
  );
  return { ...session, initialQr: await beginLiveSession(session) };
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
  await Promise.all([clearSessionQr(sessionId), revokeBeaconToken(sessionId)]);
  const updated = await prisma.attendanceSession.update({ where: { sessionId }, data: { status: 'PAUSED' } });
  broadcastSessionPaused(sessionId);
  return updated;
}

export async function resumeSession(sessionId: string, facultyId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId || session.status !== 'PAUSED') throw Errors.SESSION_NOT_ACTIVE();

  const updated = await prisma.attendanceSession.update({ where: { sessionId }, data: { status: 'ACTIVE' } });
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
  refreshTimers.set(sessionId, timer);
}

function clearRefresh(sessionId: string) {
  const existing = refreshTimers.get(sessionId);
  if (existing) {
    clearInterval(existing);
    refreshTimers.delete(sessionId);
  }
}

async function tickAndBroadcast(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId }, select: { status: true } });
  if (!session || session.status !== 'ACTIVE') {
    clearRefresh(sessionId);
    return null;
  }

  const { payload, qrImageDataUrl } = await generateNewQr(sessionId);
  const update = {
    qrImageDataUrl,
    // Only what the client needs to render the image and know when the next one is due.
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    refreshIntervalSeconds: env.QR_REFRESH_INTERVAL_SECONDS,
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
  const run = () => autoEndSession(sessionId).catch((err) => logger.error('[session] auto-end failed', { sessionId, error: err.message }));
  if (delay <= 0) {
    void run();
    return;
  }
  autoEndTimers.set(sessionId, setTimeout(run, Math.min(delay, 2_147_483_647)));
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
  await Promise.all([clearSessionQr(sessionId), revokeBeaconToken(sessionId)]);
  await prisma.attendanceSession.update({ where: { sessionId }, data: { status: 'EXPIRED', endedAt: new Date() } });
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
    data: { status: 'ENDED', endedAt: new Date() },
  });
  await Promise.all([clearSessionQr(sessionId), revokeBeaconToken(sessionId)]);
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
  await Promise.all([clearSessionQr(sessionId, { revokeHistory: false }), revokeBeaconToken(sessionId)]);
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

/** Called once at process startup to resume timers for any sessions left running (for example after a restart). */
export async function resumeActiveSessions() {
  const active = await prisma.attendanceSession.findMany({ where: { status: { in: LIVE_SESSION_STATUSES } } });
  for (const session of active) {
    if (session.status === 'ACTIVE') scheduleRefresh(session.sessionId);
    scheduleAutoEnd(session.sessionId, session.scheduledEndAt);
    logger.info('[session] resumed timers', { sessionId: session.sessionId });
  }
}
