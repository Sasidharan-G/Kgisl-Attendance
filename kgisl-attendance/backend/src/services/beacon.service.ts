import { prisma } from '../config/prisma';
import { Errors } from '../utils/AppError';
import {
  BeaconPacketError,
  encodeBeaconPacket,
  verifyBeaconPacket,
} from '../utils/beaconProtocol';
import { issueBeaconToken, resolveBeaconToken } from './beaconToken.service';

export async function issueBeaconPacket(
  sessionId: string,
  facultyId: string,
  beaconId: number
) {
  const [session, beacon] = await Promise.all([
    prisma.attendanceSession.findUnique({ where: { sessionId } }),
    prisma.classroomBeacon.findUnique({ where: { beaconId } }),
  ]);
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId) throw Errors.SESSION_ACCESS_DENIED();
  if (session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();
  if (!beacon?.enabled) throw Errors.BEACON_NOT_FOUND();
  if (beacon.roomId !== session.roomId) throw Errors.BEACON_ROOM_MISMATCH();

  const issue = await issueBeaconToken(sessionId, facultyId);
  return {
    packet: encodeBeaconPacket({ beaconId, issuedAt: issue.issuedAt, token: issue.token }),
    beaconId,
    generationId: issue.generationId,
    issuedAt: issue.issuedAt,
    expiresAt: issue.expiresAt,
    refreshAfterMs: issue.refreshAfterMs,
  };
}

export async function resolveBeaconPacket(packet: string) {
  let decoded;
  try {
    decoded = verifyBeaconPacket(packet);
  } catch (error) {
    if (error instanceof BeaconPacketError) throw Errors.BEACON_PACKET_INVALID();
    throw error;
  }

  const [beacon, token] = await Promise.all([
    prisma.classroomBeacon.findUnique({ where: { beaconId: decoded.beaconId } }),
    resolveBeaconToken(decoded.token),
  ]);
  if (!beacon?.enabled) throw Errors.BEACON_NOT_FOUND();

  const session = await prisma.attendanceSession.findUnique({
    where: { sessionId: token.sessionId },
    select: { roomId: true },
  });
  if (!session || session.roomId !== beacon.roomId) throw Errors.BEACON_ROOM_MISMATCH();
  return { beacon, token };
}
