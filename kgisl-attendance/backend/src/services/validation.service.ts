import { prisma } from '../config/prisma';
import { qrRedisKey, qrPreviousRedisKey, redis, scanLockKey } from '../config/redis';
import { env } from '../config/env';
import { verifyQrSignature, sha256Hex, QrSignableFields } from '../utils/crypto';
import { distanceMeters } from '../utils/geo';
import { Errors } from '../utils/AppError';
import { logger } from '../utils/logger';
import { broadcastAttendanceMarked, broadcastGeofenceViolation } from '../websocket/socket';
import { claimBeaconToken } from './beaconToken.service';
import { resolveBeaconPacket } from './beacon.service';
import { isPresentStatus } from '../utils/attendanceStatus';

interface StudentScanBase {
  studentId: string;
  deviceId: string;
  gps: { lat: number; lng: number; accuracy: number };
}

export interface ScanRequest extends StudentScanBase {
  qr: {
    sessionId: string;
    token: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
    signature: string;
  };
}

export interface BeaconScanRequest extends StudentScanBase {
  packet: string;
  rssi: number;
}

interface ScanResult {
  record: { id: string; scanTime: Date; status: string; method: string };
  student: { id: string; name: string; rollNo: string };
  sessionId: string;
  subjectName: string;
  distanceMeters: number;
}

type ValidatedContext = Awaited<ReturnType<typeof validateStudentSessionContext>>;

interface QrRedisEntry {
  tokenHash: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

// One Redis operation re-checks that the token is still the stored one and claims it for this student, so a rotation
// cannot slip in between the check and the claim.
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
  or tonumber(stored.expiresAt) + tonumber(ARGV[7]) < tonumber(ARGV[5]) then
  return 0
end
local claimed = redis.call('SET', KEYS[2], ARGV[1], 'NX', 'PX', ARGV[6])
if claimed then
  return 1
end
return 0
`;

/** Returns the Redis key (current or just-replaced) that holds exactly this QR token, or null when it is stale. */
async function findLiveQrKey(qr: ScanRequest['qr'], tokenHash: string): Promise<string | null> {
  const keys = [qrRedisKey(qr.sessionId), qrPreviousRedisKey(qr.sessionId)];
  const values = await redis.mget(keys);
  for (let index = 0; index < keys.length; index += 1) {
    const raw = values[index];
    if (!raw) continue;
    try {
      const entry = JSON.parse(raw) as QrRedisEntry;
      if (
        entry.tokenHash === tokenHash &&
        entry.nonce === qr.nonce &&
        entry.issuedAt === qr.issuedAt &&
        entry.expiresAt === qr.expiresAt
      ) {
        return keys[index];
      }
    } catch {
      /* a malformed entry can never match */
    }
  }
  return null;
}

async function claimQrTokenOnce(req: ScanRequest, tokenHash: string, now: number, key: string): Promise<boolean> {
  const graceMs = env.QR_GRACE_SECONDS * 1000;
  const lockTtlMs = Math.max(1000, req.qr.expiresAt + graceMs - now);
  const claimed = await redis.eval(
    CLAIM_QR_TOKEN_SCRIPT,
    2,
    key,
    scanLockKey(req.qr.sessionId, req.studentId),
    tokenHash,
    req.qr.nonce,
    req.qr.issuedAt.toString(),
    req.qr.expiresAt.toString(),
    now.toString(),
    lockTtlMs.toString(),
    graceMs.toString()
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
  // A deactivated or passed-out student may still hold a valid access token for up to its lifetime.
  if (!student.isActive || student.archivedAt !== null) throw Errors.ACCOUNT_INACTIVE();
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();
  if (session.scheduledEndAt && session.scheduledEndAt.getTime() < Date.now()) throw Errors.OUTSIDE_TIME_WINDOW();
  if (student.batchId !== session.batchId) throw Errors.BATCH_MISMATCH();

  const { gps } = input;
  if (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) throw Errors.GPS_REQUIRED();
  if (!Number.isFinite(gps.accuracy) || gps.accuracy > env.MAX_GPS_ACCURACY_METERS) throw Errors.GPS_ACCURACY_TOO_LOW();

  // Conservative boundary: the whole GPS uncertainty circle must fit inside the classroom radius. A reading 190 m
  // away with +-20 m accuracy is rejected instead of possibly accepting a student who is really 210 m away.
  const dist = distanceMeters(gps.lat, gps.lng, session.room.latitude, session.room.longitude);
  if (dist + gps.accuracy > session.room.geofenceRadiusM) {
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
  // Only a record that already counts as attended is a duplicate. A student who has an approved LEAVE (added
  // automatically when the class started) but actually turns up must still be able to mark themselves present,
  // and a faculty "absent" override from earlier in the same class must not lock them out either.
  if (existing && isPresentStatus(existing.status)) throw Errors.DUPLICATE_ATTENDANCE();

  return { student, session, distanceMeters: dist };
}

async function persistAttendance(
  context: ValidatedContext,
  input: StudentScanBase,
  method: 'QR' | 'BEACON'
): Promise<ScanResult> {
  try {
    const evidence = {
      scanTime: new Date(),
      gpsLat: input.gps.lat,
      gpsLng: input.gps.lng,
      gpsAccuracy: input.gps.accuracy,
      distanceFromCampus: context.distanceMeters,
      locationVerified: true,
      locationVerificationStatus: 'GPS_VERIFIED',
      locationVerifiedAt: new Date(),
      deviceId: input.deviceId,
      status: 'PRESENT' as const,
      method,
      // A genuine scan replaces any earlier system/faculty placeholder (e.g. auto-applied leave).
      markedByFacultyId: null,
      overrideReason: null,
    };
    const record = await prisma.attendanceRecord.upsert({
      where: { uq_student_session: { studentId: context.student.id, sessionId: context.session.sessionId } },
      create: { studentId: context.student.id, sessionId: context.session.sessionId, ...evidence },
      update: evidence,
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
      method,
      distanceMeters: Math.round(context.distanceMeters),
    });

    return {
      record: { id: record.id, scanTime: record.scanTime, status: record.status, method: record.method },
      student: { id: context.student.id, name: context.student.name, rollNo: context.student.rollNo },
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
  const signableFields: QrSignableFields = {
    sessionId: req.qr.sessionId,
    token: req.qr.token,
    issuedAt: req.qr.issuedAt,
    expiresAt: req.qr.expiresAt,
    nonce: req.qr.nonce,
  };
  if (!verifyQrSignature(signableFields, req.qr.signature)) throw Errors.INVALID_SIGNATURE();
  if (now > req.qr.expiresAt + env.QR_GRACE_SECONDS * 1000) throw Errors.QR_EXPIRED();

  // The signature is genuine, so a token that is neither the current nor the just-replaced one is simply old.
  const tokenHash = sha256Hex(req.qr.token);
  const liveKey = await findLiveQrKey(req.qr, tokenHash);
  if (!liveKey) throw Errors.QR_EXPIRED();

  const context = await validateStudentSessionContext({
    studentId: req.studentId,
    deviceId: req.deviceId,
    gps: req.gps,
    sessionId: req.qr.sessionId,
  });

  const claimed = await claimQrTokenOnce(req, tokenHash, now, liveKey);
  if (!claimed) throw Errors.TOKEN_ALREADY_USED();
  return persistAttendance(context, req, 'QR');
}

export async function validateAndRecordBeaconScan(req: BeaconScanRequest): Promise<ScanResult> {
  if (req.rssi < env.BEACON_MIN_RSSI_DBM) throw Errors.BEACON_SIGNAL_TOO_WEAK();
  const { token } = await resolveBeaconPacket(req.packet);
  const context = await validateStudentSessionContext({
    studentId: req.studentId,
    deviceId: req.deviceId,
    gps: req.gps,
    sessionId: token.sessionId,
  });

  const claimed = await claimBeaconToken(token, req.studentId);
  if (!claimed) throw Errors.BEACON_PACKET_INVALID();
  return persistAttendance(context, req, 'BEACON');
}
