import { prisma } from '../config/prisma';
import { redis, qrRedisKey } from '../config/redis';
import { env } from '../config/env';
import { verifyQrSignature, sha256Hex, QrSignableFields } from '../utils/crypto';
import { distanceMeters } from '../utils/geo';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { broadcastAttendanceMarked, broadcastGeofenceViolation } from '../websocket/socket';

export interface ScanRequest {
  studentId: string;
  deviceId: string;
  batchIdClaimed: string;
  subjectIdClaimed: string;
  gps: { lat: number; lng: number; accuracy: number };
  qr: {
    sessionId: string;
    token: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
    signature: string;
  };
}

export interface ScanResult {
  record: { id: string; scanTime: Date; status: string };
  student: { id: string; name: string; rollNo: string };
  subjectName: string;
  distanceMeters: number;
}

/**
 * Atomically claims a Redis-held QR token for single use.
 * Uses a Lua script so "read current token -> compare -> mark used" happens as
 * one atomic operation, closing the race window between two near-simultaneous
 * scans of the same still-valid QR (replay / QR-sharing prevention).
 *
 * Returns true if this call is the one that gets to consume the token.
 */
const CLAIM_TOKEN_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if not stored then
  return 0
end
local usedKey = KEYS[1] .. ':used:' .. ARGV[1]
local wasSet = redis.call('SET', usedKey, ARGV[1], 'NX', 'PX', ARGV[2])
if wasSet then
  return 1
else
  return 0
end
`;

async function claimTokenOnce(sessionId: string, studentId: string, ttlMs: number): Promise<boolean> {
  const result = await redis.eval(CLAIM_TOKEN_SCRIPT, 1, qrRedisKey(sessionId), studentId, ttlMs.toString());
  return result === 1;
}

export async function validateAndRecordScan(req: ScanRequest): Promise<ScanResult> {
  const { studentId, deviceId, gps, qr } = req;

  // ---------------------------------------------------------------
  // 1. Validate Student — exists and fetch full record
  // ---------------------------------------------------------------
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw Errors.STUDENT_NOT_FOUND();

  // ---------------------------------------------------------------
  // 2. Validate Active Session (load room + subject for downstream checks)
  // ---------------------------------------------------------------
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId: qr.sessionId },
    include: { room: true, subject: true },
  });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();

  // ---------------------------------------------------------------
  // 3. Validate QR Signature (HMAC-SHA256, constant-time compare)
  // ---------------------------------------------------------------
  const signableFields: QrSignableFields = {
    sessionId: qr.sessionId,
    token: qr.token,
    issuedAt: qr.issuedAt,
    expiresAt: qr.expiresAt,
    nonce: qr.nonce,
  };
  if (!verifyQrSignature(signableFields, qr.signature)) {
    throw Errors.INVALID_SIGNATURE();
  }

  // ---------------------------------------------------------------
  // 4. Validate QR Expiry (server clock is source of truth)
  // ---------------------------------------------------------------
  const now = Date.now();
  const skewMs = env.QR_CLOCK_SKEW_TOLERANCE_SECONDS * 1000;
  if (now > qr.expiresAt + skewMs) {
    throw Errors.QR_EXPIRED();
  }

  // ---------------------------------------------------------------
  // 5. Validate QR not issued in the future (clock manipulation check)
  // ---------------------------------------------------------------
  if (qr.issuedAt > now + skewMs) {
    throw Errors.QR_EXPIRED();
  }

  // ---------------------------------------------------------------
  // 6. Validate Secure Token — must match Redis live active token
  // ---------------------------------------------------------------
  const redisRaw = await redis.get(qrRedisKey(qr.sessionId));
  if (!redisRaw) throw Errors.QR_EXPIRED(); // Redis TTL already evicted it

  const redisEntry = JSON.parse(redisRaw) as {
    tokenHash: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
  };

  const incomingTokenHash = sha256Hex(qr.token);
  if (incomingTokenHash !== redisEntry.tokenHash || qr.nonce !== redisEntry.nonce) {
    throw Errors.INVALID_SIGNATURE(); // token doesn't match the currently active one
  }

  // ---------------------------------------------------------------
  // 7. Validate Token Not Revoked & Not Previously Used
  //    (Redis = fast path; Postgres = audit-grade backstop)
  // ---------------------------------------------------------------
  const historyRow = await prisma.attendanceQrHistory.findUnique({
    where: { tokenHash: incomingTokenHash },
  });
  if (!historyRow || historyRow.revoked) throw Errors.TOKEN_REVOKED();

  // ---------------------------------------------------------------
  // 8. Validate Batch
  // ---------------------------------------------------------------
  if (student.batchId !== session.batchId) throw Errors.BATCH_MISMATCH();

  // ---------------------------------------------------------------
  // 9. Validate Subject
  // ---------------------------------------------------------------
  if (req.subjectIdClaimed !== session.subjectId) throw Errors.SUBJECT_MISMATCH();

  // ---------------------------------------------------------------
  // 10. Validate Session Still Active (re-check before write)
  // ---------------------------------------------------------------
  const freshSession = await prisma.attendanceSession.findUnique({ where: { sessionId: qr.sessionId } });
  if (!freshSession || freshSession.status !== 'ACTIVE') throw Errors.OUTSIDE_TIME_WINDOW();

  // ---------------------------------------------------------------
  // 11. Validate GPS Present & Coordinates Valid
  // ---------------------------------------------------------------
  if (
    gps.lat === undefined ||
    gps.lng === undefined ||
    Number.isNaN(gps.lat) ||
    Number.isNaN(gps.lng)
  ) {
    throw Errors.GPS_REQUIRED();
  }

  // ---------------------------------------------------------------
  // 12. Validate required browser GPS accuracy measurement
  // ---------------------------------------------------------------
  if (!Number.isFinite(gps.accuracy) || gps.accuracy > env.MAX_GPS_ACCURACY_METERS) {
    throw Errors.GPS_ACCURACY_TOO_LOW();
  }

  // ---------------------------------------------------------------
  // 13. Validate Campus Geofence (Haversine)
  // ---------------------------------------------------------------
  const dist = distanceMeters(gps.lat, gps.lng, session.room.latitude, session.room.longitude);
  const allowedRadius = session.room.geofenceRadiusM ?? env.DEFAULT_GEOFENCE_RADIUS_M;
  if (dist > allowedRadius) {
    // The controller records this rejection in the append-only audit log. Do
    // not occupy the unique attendance row: the student can move into range
    // and retry with the next live QR.
    // Broadcast geofence violation to faculty dashboard.
    broadcastGeofenceViolation(qr.sessionId, {
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.rollNo,
      scanTime: new Date().toISOString(),
      distance: Math.round(dist),
    });
    throw Errors.OUTSIDE_GEOFENCE();
  }

  // ---------------------------------------------------------------
  // 14. Validate Device Binding
  //     First scan for this student — auto-bind the device.
  //     Subsequent scans — must match the registered device.
  // ---------------------------------------------------------------
  if (student.deviceId === null) {
    // First-time bind — silently register and continue.
    await prisma.student.update({
      where: { id: studentId },
      data: { deviceId },
    });
    logger.info('[scan] device bound for student', {
      studentId,
      deviceId: deviceId.slice(0, 8) + '...',
    });
  } else if (student.deviceId !== deviceId) {
    logger.warn('[scan] device mismatch', {
      studentId,
      expected: student.deviceId.slice(0, 8) + '...',
      received: deviceId.slice(0, 8) + '...',
    });
    throw Errors.DEVICE_NOT_AUTHORIZED();
  }

  // ---------------------------------------------------------------
  // 15. Validate No Duplicate Attendance
  // ---------------------------------------------------------------
  const existing = await prisma.attendanceRecord.findUnique({
    where: { uq_student_session: { studentId, sessionId: qr.sessionId } },
  });
  if (existing) throw Errors.DUPLICATE_ATTENDANCE();

  // Per-student atomic claim: many students may scan the same live classroom
  // QR, but the same student cannot double-submit that QR token.
  const claimed = await claimTokenOnce(
    qr.sessionId,
    studentId,
    qr.expiresAt - now > 0 ? qr.expiresAt - now : 1000
  );
  if (!claimed) throw Errors.TOKEN_ALREADY_USED();

  // ---------------------------------------------------------------
  // ALL CHECKS PASSED → persist atomically
  // ---------------------------------------------------------------
  try {
    const record = await prisma.attendanceRecord.create({
        data: {
          studentId,
          sessionId: qr.sessionId,
          gpsLat: gps.lat,
          gpsLng: gps.lng,
          gpsAccuracy: gps.accuracy ?? null,
          distanceFromCampus: dist,
          locationVerified: true,
          locationVerificationStatus: 'GPS_VERIFIED',
          locationVerifiedAt: new Date(),
          deviceId,
          status: 'PRESENT',
        },
      });

    logger.info('[scan] attendance recorded', { sessionId: qr.sessionId, studentId });

    broadcastAttendanceMarked(qr.sessionId, {
      studentId,
      studentName: student.name,
      studentRoll: student.rollNo,
      scanTime: record.scanTime.toISOString(),
    });

    return {
      record: { id: record.id, scanTime: record.scanTime, status: record.status },
      student: { id: student.id, name: student.name, rollNo: student.rollNo },
      subjectName: session.subject.name,
      distanceMeters: dist,
    };
  } catch (err: any) {
    // Unique constraint race (two requests slipped past the earlier check simultaneously).
    if (err.code === 'P2002') throw Errors.DUPLICATE_ATTENDANCE();
    throw err;
  }
}
