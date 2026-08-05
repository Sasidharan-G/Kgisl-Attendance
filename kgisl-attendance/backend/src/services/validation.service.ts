import { prisma } from '../config/prisma';
import { qrRedisKey, redis, scanLockKey } from '../config/redis';
import { env } from '../config/env';
import { verifyQrSignature, sha256Hex, QrSignableFields } from '../utils/crypto';
import { distanceMeters } from '../utils/geo';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { broadcastAttendanceMarked, broadcastGeofenceViolation } from '../websocket/socket';
import {
  claimAcousticToken,
  resolveAcousticToken,
  ResolvedAcousticToken,
} from './acoustic.service';

interface StudentScanBase {
  studentId: string;
  deviceId: string;
  gps: { lat: number; lng: number; accuracy: number };
}

export interface ScanRequest extends StudentScanBase {
  batchIdClaimed: string;
  subjectIdClaimed: string;
  qr: {
    sessionId: string;
    token: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
    signature: string;
  };
}

export interface AcousticScanRequest extends StudentScanBase {
  token: string;
}

export interface ScanResult {
  record: { id: string; scanTime: Date; status: string; method: string };
  student: { id: string; name: string; rollNo: string };
  sessionId: string;
  subjectName: string;
  distanceMeters: number;
}

type ValidatedContext = Awaited<ReturnType<typeof validateStudentSessionContext>>;

// QR validation and the per-student claim occur in one Redis operation. In
// particular, a refresh cannot replace the token after a GET and before claim.
const CLAIM_QR_TOKEN_SCRIPT = `
local storedRaw = redis.call('GET', KEYS[1])
if not storedRaw then
  return 0
end
local stored = cjson.decode(storedRaw)
if stored.tokenHash ~= ARGV[1]
  or stored.nonce ~= ARGV[2]
  or tonumber(stored.issuedAt) ~= tonumber(ARGV[3])
  or tonumber(stored.expiresAt) ~= tonumber(ARGV[4])
  or tonumber(stored.expiresAt) < tonumber(ARGV[5]) then
  return 0
end
local claimed = redis.call('SET', KEYS[2], ARGV[1], 'NX', 'PX', ARGV[6])
if claimed then
  return 1
end
return 0
`;

async function claimQrTokenOnce(
  req: ScanRequest,
  tokenHash: string,
  now: number
): Promise<boolean> {
  const ttlMs = Math.max(1000, req.qr.expiresAt - now);
  const claimed = await redis.eval(
    CLAIM_QR_TOKEN_SCRIPT,
    2,
    qrRedisKey(req.qr.sessionId),
    scanLockKey(req.qr.sessionId, req.studentId),
    tokenHash,
    req.qr.nonce,
    req.qr.issuedAt.toString(),
    req.qr.expiresAt.toString(),
    now.toString(),
    ttlMs.toString()
  );
  return claimed === 1;
}

async function validateStudentSessionContext(input: StudentScanBase & { sessionId: string }) {
  const [student, session] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId } }),
    prisma.attendanceSession.findUnique({
      where: { sessionId: input.sessionId },
      include: { room: true, subject: true },
    }),
  ]);

  if (!student) throw Errors.STUDENT_NOT_FOUND();
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();
  if (session.scheduledEndAt && session.scheduledEndAt.getTime() < Date.now()) {
    throw Errors.OUTSIDE_TIME_WINDOW();
  }
  if (student.batchId !== session.batchId) throw Errors.BATCH_MISMATCH();

  const { gps } = input;
  if (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) throw Errors.GPS_REQUIRED();
  if (!Number.isFinite(gps.accuracy) || gps.accuracy > env.MAX_GPS_ACCURACY_METERS) {
    throw Errors.GPS_ACCURACY_TOO_LOW();
  }

  const dist = distanceMeters(gps.lat, gps.lng, session.room.latitude, session.room.longitude);
  const allowedRadius = session.room.geofenceRadiusM ?? env.DEFAULT_GEOFENCE_RADIUS_M;
  // Conservative boundary: the complete GPS uncertainty circle must fit inside
  // the geofence. A 190 m reading with ±20 m accuracy is therefore rejected
  // instead of potentially accepting a student who is actually 210 m away.
  const boundaryDistance = dist + gps.accuracy;
  if (boundaryDistance > allowedRadius) {
    broadcastGeofenceViolation(session.sessionId, {
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.rollNo,
      scanTime: new Date().toISOString(),
      distance: Math.round(dist),
    });
    throw Errors.OUTSIDE_GEOFENCE();
  }

  if (student.deviceId === null) {
    // Conditional update closes the first-scan race between two devices.
    const bound = await prisma.student.updateMany({
      where: { id: student.id, deviceId: null },
      data: { deviceId: input.deviceId },
    });
    if (bound.count === 0) {
      const latest = await prisma.student.findUnique({ where: { id: student.id } });
      if (latest?.deviceId !== input.deviceId) throw Errors.DEVICE_NOT_AUTHORIZED();
    } else {
      logger.info('[scan] device bound for student', { studentId: student.id });
    }
  } else if (student.deviceId !== input.deviceId) {
    logger.warn('[scan] device mismatch', { studentId: student.id });
    throw Errors.DEVICE_NOT_AUTHORIZED();
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { uq_student_session: { studentId: student.id, sessionId: session.sessionId } },
  });
  if (existing) throw Errors.DUPLICATE_ATTENDANCE();

  return { student, session, distanceMeters: dist };
}

async function persistAttendance(
  context: ValidatedContext,
  input: StudentScanBase,
  method: 'QR' | 'ACOUSTIC'
): Promise<ScanResult> {
  try {
    const record = await prisma.attendanceRecord.create({
      data: {
        studentId: context.student.id,
        sessionId: context.session.sessionId,
        gpsLat: input.gps.lat,
        gpsLng: input.gps.lng,
        gpsAccuracy: input.gps.accuracy,
        distanceFromCampus: context.distanceMeters,
        locationVerified: true,
        locationVerificationStatus: 'GPS_VERIFIED',
        locationVerifiedAt: new Date(),
        deviceId: input.deviceId,
        status: 'PRESENT',
        method,
      },
    });

    logger.info('[scan] attendance recorded', {
      sessionId: context.session.sessionId,
      studentId: context.student.id,
      method,
    });
    broadcastAttendanceMarked(context.session.sessionId, {
      studentId: context.student.id,
      studentName: context.student.name,
      studentRoll: context.student.rollNo,
      scanTime: record.scanTime.toISOString(),
    });

    return {
      record: {
        id: record.id,
        scanTime: record.scanTime,
        status: record.status,
        method: record.method,
      },
      student: {
        id: context.student.id,
        name: context.student.name,
        rollNo: context.student.rollNo,
      },
      sessionId: context.session.sessionId,
      subjectName: context.session.subject.name,
      distanceMeters: context.distanceMeters,
    };
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      throw Errors.DUPLICATE_ATTENDANCE();
    }
    throw err;
  }
}

export async function validateAndRecordScan(req: ScanRequest): Promise<ScanResult> {
  const now = Date.now();
  const skewMs = env.QR_CLOCK_SKEW_TOLERANCE_SECONDS * 1000;
  const signableFields: QrSignableFields = {
    sessionId: req.qr.sessionId,
    token: req.qr.token,
    issuedAt: req.qr.issuedAt,
    expiresAt: req.qr.expiresAt,
    nonce: req.qr.nonce,
  };
  if (!verifyQrSignature(signableFields, req.qr.signature)) throw Errors.INVALID_SIGNATURE();
  if (now > req.qr.expiresAt + skewMs || req.qr.issuedAt > now + skewMs) {
    throw Errors.QR_EXPIRED();
  }

  const redisRaw = await redis.get(qrRedisKey(req.qr.sessionId));
  if (!redisRaw) throw Errors.QR_EXPIRED();
  let redisEntry: { tokenHash: string; nonce: string; issuedAt: number; expiresAt: number };
  try {
    redisEntry = JSON.parse(redisRaw) as typeof redisEntry;
  } catch {
    throw Errors.QR_EXPIRED();
  }
  const tokenHash = sha256Hex(req.qr.token);
  if (
    redisEntry.tokenHash !== tokenHash ||
    redisEntry.nonce !== req.qr.nonce ||
    redisEntry.issuedAt !== req.qr.issuedAt ||
    redisEntry.expiresAt !== req.qr.expiresAt
  ) {
    throw Errors.INVALID_SIGNATURE();
  }

  const history = await prisma.attendanceQrHistory.findUnique({ where: { tokenHash } });
  if (!history || history.revoked || history.isExpired) throw Errors.TOKEN_REVOKED();

  const context = await validateStudentSessionContext({
    studentId: req.studentId,
    deviceId: req.deviceId,
    gps: req.gps,
    sessionId: req.qr.sessionId,
  });
  if (req.batchIdClaimed !== context.session.batchId) throw Errors.BATCH_MISMATCH();
  if (req.subjectIdClaimed !== context.session.subjectId) throw Errors.SUBJECT_MISMATCH();

  const claimed = await claimQrTokenOnce(req, tokenHash, now);
  if (!claimed) throw Errors.TOKEN_ALREADY_USED();
  return persistAttendance(context, req, 'QR');
}

export async function validateAndRecordAcousticScan(
  req: AcousticScanRequest
): Promise<ScanResult> {
  const resolved: ResolvedAcousticToken = await resolveAcousticToken(req.token);
  const context = await validateStudentSessionContext({
    studentId: req.studentId,
    deviceId: req.deviceId,
    gps: req.gps,
    sessionId: resolved.sessionId,
  });

  const claimed = await claimAcousticToken(resolved, req.studentId);
  if (!claimed) throw Errors.ACOUSTIC_TOKEN_INVALID();
  return persistAttendance(context, req, 'ACOUSTIC');
}
