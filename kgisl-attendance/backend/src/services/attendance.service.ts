import { prisma } from '../config/prisma';
import { redis, qrRedisKey } from '../config/redis';
import { sha256Hex, verifyQrSignature } from '../utils/crypto';
import { broadcastGeofenceViolation } from '../websocket/socket';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

const KGISL_LAT = 11.0834393;
const KGISL_LNG = 76.9970460;
const MAX_RADIUS = 150;

export async function markAttendance(input: {
  studentId: string;
  qrPayload: any;
  gpsLat: number;
  gpsLng: number;
  gpsAccuracy?: number;
  deviceId: string;
}) {
  const { studentId, qrPayload, gpsLat, gpsLng, gpsAccuracy, deviceId } = input;

  const validSignature = verifyQrSignature(qrPayload, qrPayload.signature);
  if (!validSignature) throw new Error('INVALID_QR_SIGNATURE');

  if (Date.now() > qrPayload.expiresAt) throw new Error('QR_EXPIRED');

  const student = await prisma.student.findUnique({
    where: { id: studentId },
  });

  if (!student) throw new Error('STUDENT_NOT_FOUND');

  if (
    typeof gpsLat !== 'number' || typeof gpsLng !== 'number' ||
    Number.isNaN(gpsLat) || Number.isNaN(gpsLng) ||
    gpsLat < -90 || gpsLat > 90 || gpsLng < -180 || gpsLng > 180
  ) {
    throw new Error('INVALID_GPS');
  }

  if (typeof gpsAccuracy === 'number' && gpsAccuracy > 100) {
    throw new Error('POOR_GPS_ACCURACY');
  }

  const distanceFromCampus = calculateDistance(gpsLat, gpsLng, KGISL_LAT, KGISL_LNG);
  if (distanceFromCampus > MAX_RADIUS) {
    broadcastGeofenceViolation(qrPayload.sessionId, {
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.rollNo,
      scanTime: new Date().toISOString(),
      distance: Math.round(distanceFromCampus),
    });
    throw new Error('GEOFENCE_REJECTED');
  }

  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId: qrPayload.sessionId },
    include: { room: true },
  });

  if (!session || session.status !== 'ACTIVE') throw new Error('SESSION_NOT_ACTIVE');

  if (student.batchId !== session.batchId) throw new Error('WRONG_BATCH');

  const redisData = await redis.get(qrRedisKey(qrPayload.sessionId));
  if (!redisData) throw new Error('QR_EXPIRED');

  const tokenHash = sha256Hex(qrPayload.token);
  const parsed = JSON.parse(redisData);

  if (parsed.tokenHash !== tokenHash) throw new Error('INVALID_OR_OLD_QR');

  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      uq_student_session: {
        studentId,
        sessionId: qrPayload.sessionId,
      },
    },
  });

  if (existing) throw new Error('ALREADY_MARKED');

  const record = await prisma.attendanceRecord.create({
    data: {
      studentId,
      sessionId: qrPayload.sessionId,
      gpsLat,
      gpsLng,
      gpsAccuracy,
      distanceFromCampus,
      locationVerified: true,
      locationVerificationStatus: 'VERIFIED',
      locationVerifiedAt: new Date(),
      deviceId,
      status: 'PRESENT',
    },
  });

  return record;
}

export async function markManualAttendance(input: {
  sessionId: string;
  rollNo: string;
  facultyId: string;
}) {
  const { sessionId, rollNo, facultyId } = input;

  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId },
  });

  if (!session || session.status !== 'ACTIVE' || session.facultyId !== facultyId) {
    throw new Error('SESSION_NOT_ACTIVE_OR_INVALID_FACULTY');
  }

  const student = await prisma.student.findUnique({
    where: { rollNo },
  });

  if (!student) throw new Error('STUDENT_NOT_FOUND');
  if (student.batchId !== session.batchId) throw new Error('WRONG_BATCH');

  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      uq_student_session: {
        studentId: student.id,
        sessionId,
      },
    },
  });

  if (existing) throw new Error('ALREADY_MARKED');

  const record = await prisma.attendanceRecord.create({
    data: {
      studentId: student.id,
      sessionId,
      gpsLat: 0,
      gpsLng: 0,
      deviceId: 'MANUAL_ENTRY',
      status: 'PRESENT',
    },
  });

  return { record, student };
}
