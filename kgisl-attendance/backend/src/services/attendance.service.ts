import { prisma } from '../config/prisma';
import { Errors } from '../utils/AppError';

export type FacultyAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_DUTY' | 'LEAVE';

export interface FacultyAttendanceOverrideInput {
  sessionId: string;
  rollNo: string;
  facultyId: string;
  status: FacultyAttendanceStatus;
  reason: string;
}

/**
 * Authenticated faculty correction. Existing capture evidence is retained:
 * method/GPS/device continue to describe the original QR/acoustic mark, while
 * the faculty actor and mandatory reason explain the override.
 */
export async function overrideAttendance(input: FacultyAttendanceOverrideInput) {
  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId: input.sessionId },
  });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== input.facultyId) throw Errors.SESSION_ACCESS_DENIED();

  const student = await prisma.student.findUnique({ where: { rollNo: input.rollNo } });
  if (!student) throw Errors.STUDENT_NOT_FOUND();
  if (student.batchId !== session.batchId) throw Errors.BATCH_MISMATCH();

  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      uq_student_session: { studentId: student.id, sessionId: session.sessionId },
    },
    select: { status: true, method: true },
  });

  const record = await prisma.attendanceRecord.upsert({
    where: {
      uq_student_session: { studentId: student.id, sessionId: session.sessionId },
    },
    update: {
      status: input.status,
      markedByFacultyId: input.facultyId,
      overrideReason: input.reason,
    },
    create: {
      studentId: student.id,
      sessionId: session.sessionId,
      status: input.status,
      method: 'FACULTY_MANUAL',
      gpsLat: null,
      gpsLng: null,
      gpsAccuracy: null,
      distanceFromCampus: null,
      deviceId: null,
      locationVerified: false,
      locationVerificationStatus: 'FACULTY_VERIFIED',
      locationVerifiedAt: new Date(),
      markedByFacultyId: input.facultyId,
      overrideReason: input.reason,
    },
  });

  return {
    record,
    student,
    created: existing === null,
    previousStatus: existing?.status ?? null,
    originalMethod: existing?.method ?? 'FACULTY_MANUAL',
  };
}
