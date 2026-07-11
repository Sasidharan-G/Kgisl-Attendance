import { prisma } from '../config/prisma';
import { redis, qrRedisKey } from '../config/redis';
import { env } from '../config/env';
import { generateNewQr } from './qr.service';
import { broadcastQrUpdate, broadcastSessionEnded } from '../websocket/socket';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';

// In-memory registry of active refresh timers, keyed by sessionId.
// (For a multi-instance deployment, promote this to a Redis-backed leader-election
//  or a dedicated worker process so only one instance owns the timer per session.)
const activeTimers = new Map<string, NodeJS.Timeout>();

export interface StartSessionInput {
  facultyId: string;
  allocationId: string;
  subjectId: string;
  roomId: string;
  batchId: string;
}

export async function startSession(input: StartSessionInput) {
  const allocation = await prisma.timetableAllocation.findFirst({
    where: { id: input.allocationId, facultyId: input.facultyId },
  });
  if (!allocation || allocation.subjectId !== input.subjectId || allocation.roomId !== input.roomId || allocation.batchId !== input.batchId) {
    throw Errors.SESSION_NOT_ACTIVE();
  }
  const session = await prisma.attendanceSession.create({
    data: {
      facultyId: input.facultyId,
      subjectId: input.subjectId,
      roomId: input.roomId,
      batchId: input.batchId,
      status: 'ACTIVE',
    },
  });

  await tickAndBroadcast(session.sessionId); // issue the very first QR immediately
  scheduleRefresh(session.sessionId);

  return session;
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
    return;
  }

  const { payload, qrImageDataUrl } = await generateNewQr(sessionId);
  const stats = await getSessionStats(sessionId);

  broadcastQrUpdate(sessionId, {
    qrImageDataUrl,
    // Note: we only ever emit the payload fields the client needs to render the
    // image + know when to expect the next one — the server drives the countdown.
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    refreshIntervalSeconds: env.QR_REFRESH_INTERVAL_SECONDS,
    stats,
  });
}

export async function endSession(sessionId: string, facultyId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId) throw Errors.SESSION_NOT_ACTIVE();

  clearRefresh(sessionId);

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
  await redis.del(qrRedisKey(sessionId));
  await prisma.attendanceQrHistory.updateMany({
    where: { sessionId, isExpired: false },
    data: { isExpired: true, revoked: true },
  });

  broadcastSessionEnded(sessionId);
  return updated;
}

export async function getSessionStats(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId },
    include: { batch: { include: { students: true } } },
  });
  if (!session) throw Errors.SESSION_NOT_FOUND();

  const totalStudents = session.batch.students.length;
  const presentCount = await prisma.attendanceRecord.count({
    where: { sessionId, status: 'PRESENT' },
  });

  return {
    totalStudents,
    present: presentCount,
    absent: totalStudents - presentCount,
    progressPercent: totalStudents === 0 ? 0 : Math.round((presentCount / totalStudents) * 10000) / 100,
  };
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
  const active = await prisma.attendanceSession.findMany({ where: { status: 'ACTIVE' } });
  for (const s of active) {
    scheduleRefresh(s.sessionId);
    logger.info('[session] resumed refresh timer', { sessionId: s.sessionId });
  }
}
