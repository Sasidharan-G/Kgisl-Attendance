import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { allowedOrigins } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';
import { verifyAccessToken, type AuthPayload } from '../middleware/auth.middleware';

let io: SocketIOServer | null = null;

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A session room carries the live rotating QR image and every student's scan. Only the faculty member
 * who owns the session (or an admin) may listen; otherwise any logged-in student who learned a session id
 * could watch the QR from home and defeat the "be in the classroom" check.
 */
export function canJoinSessionRoom(
  auth: Pick<AuthPayload, 'sub' | 'role' | 'mcp'>,
  session: { facultyId: string } | null
): boolean {
  if (!session || auth.mcp) return false;
  if (auth.role === 'ADMIN') return true;
  return auth.role === 'FACULTY' && session.facultyId === auth.sub;
}

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  // Auth handshake: every socket connection must present a valid access token.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const decoded = verifyAccessToken(token);
      // A session that still has to replace its initial password may not use any live channel.
      if (decoded.mcp) return next(new Error('PASSWORD_CHANGE_REQUIRED'));
      (socket.data as { auth?: AuthPayload }).auth = decoded;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_session', async (sessionId: unknown) => {
      if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) return;
      try {
        const session = await prisma.attendanceSession.findUnique({ where: { sessionId }, select: { facultyId: true } });
        if (!canJoinSessionRoom((socket.data as { auth: AuthPayload }).auth, session)) {
          socket.emit('join_denied', { sessionId });
          return;
        }
        socket.join(sessionRoom(sessionId));
        logger.debug('[ws] socket joined session', { sessionId, socketId: socket.id });
      } catch (err) {
        logger.error('[ws] join_session failed', { sessionId, error: (err as Error).message });
      }
    });
  });

  return io;
}

function sessionRoom(sessionId: string) {
  return `session:${sessionId}`;
}

interface QrUpdatePayload {
  qrImageDataUrl: string;
  issuedAt: number;
  expiresAt: number;
  refreshIntervalSeconds: number;
}

/** Pushed on every QR refresh: the frontend swaps the image and resets the countdown, it never reloads. */
export function broadcastQrUpdate(sessionId: string, payload: QrUpdatePayload) {
  io?.to(sessionRoom(sessionId)).emit('qr_updated', payload);
}

/** Pushed the moment a scan is accepted, so the live counters and the activity list update at once. */
export function broadcastAttendanceMarked(
  sessionId: string,
  data: {
    studentId: string;
    studentName: string;
    studentRoll: string;
    scanTime: string;
    method: 'QR' | 'BEACON';
    distanceMeters?: number;
  }
) {
  io?.to(sessionRoom(sessionId)).emit('attendance_marked', data);
}

/** Faculty overrides are a distinct event so clients can update present/absent state correctly. */
export function broadcastAttendanceCorrected(
  sessionId: string,
  data: {
    studentId: string;
    studentName: string;
    studentRoll: string;
    status: string;
    method: string;
    updatedAt: string;
  }
) {
  io?.to(sessionRoom(sessionId)).emit('attendance_corrected', data);
}

export function broadcastSessionEnded(sessionId: string) {
  io?.to(sessionRoom(sessionId)).emit('session_ended', { sessionId });
}

export function broadcastSessionPaused(sessionId: string) {
  io?.to(sessionRoom(sessionId)).emit('session_paused', { sessionId });
}

export function broadcastGeofenceViolation(
  sessionId: string,
  data: { studentId: string; studentName: string; studentRoll: string; scanTime: string; distance: number }
) {
  io?.to(sessionRoom(sessionId)).emit('geofence_violation', data);
}
