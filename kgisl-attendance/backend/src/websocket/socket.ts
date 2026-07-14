import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env, allowedOrigins } from '../config/env';
import { logger } from '../utils/logger';
import type { AuthPayload } from '../middleware/auth.middleware';

let io: SocketIOServer | null = null;

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  // Auth handshake — every socket connection must present a valid JWT.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
      (socket.data as any).auth = decoded;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_session', (sessionId: string) => {
      // Room-per-session keeps broadcasts scoped — students/faculty only ever
      // receive updates for the exact session they're viewing.
      socket.join(sessionRoom(sessionId));
      logger.debug('[ws] socket joined session', { sessionId, socketId: socket.id });
    });

    socket.on('leave_session', (sessionId: string) => {
      socket.leave(sessionRoom(sessionId));
    });

    socket.on('disconnect', () => {
      logger.debug('[ws] socket disconnected', { socketId: socket.id });
    });
  });

  return io;
}

function sessionRoom(sessionId: string) {
  return `session:${sessionId}`;
}

export interface QrUpdatePayload {
  qrImageDataUrl: string;
  issuedAt: number;
  expiresAt: number;
  refreshIntervalSeconds: number;
  stats: {
    totalStudents: number;
    present: number;
    absent: number;
    progressPercent: number;
  };
}

/** Pushed on every QR refresh — frontend swaps the image + resets countdown, NEVER reloads the page. */
export function broadcastQrUpdate(sessionId: string, payload: QrUpdatePayload) {
  io?.to(sessionRoom(sessionId)).emit('qr_updated', payload);
}

/** Pushed the moment a scan is accepted, so the "Recent Scans" / present-count UI updates live. */
export function broadcastAttendanceMarked(
  sessionId: string,
  data: { studentId: string; studentName: string; studentRoll: string; scanTime: string }
) {
  io?.to(sessionRoom(sessionId)).emit('attendance_marked', data);
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
