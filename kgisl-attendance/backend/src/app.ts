import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import sessionRoutes from './routes/session.routes';
import scanRoutes from './routes/scan.routes';
import authRoutes from './routes/auth.routes';
import catalogRoutes from './routes/catalog.routes';
import facultyRoutes from './routes/faculty.routes';
import timetableRoutes from './routes/timetable.routes';
import studentRoutes from './routes/student.routes';
import historyRoutes from './routes/history.routes';
import attendanceRoutes from './routes/attendance.routes';
import agentRoutes from './routes/agent.routes';
import leaveRoutes from './routes/leave.routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import { allowedOrigins } from './config/env';
import { prisma } from './config/prisma';
import { redis } from './config/redis';

export function createApp() {
  const app = express();

  // Needed so req.ip reflects the real client (not the load balancer/reverse proxy),
  // which audit logs and IP-based rate limiting both depend on.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'], // QR codes are served as base64 data: URLs
          connectSrc: ["'self'", ...allowedOrigins],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '32kb' })); // QR/scan payloads are tiny — cap body size

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
  });

  const readinessHandler = async (_req: express.Request, res: express.Response) => {
    const checks = { database: false, redis: false };
    try { await prisma.$queryRaw`SELECT 1`; checks.database = true; } catch { /* reported below */ }
    try { checks.redis = (await redis.ping()) === 'PONG'; } catch { /* reported below */ }
    const healthy = checks.database && checks.redis;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/health', readinessHandler);
  app.get('/health/ready', readinessHandler);

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/catalog', catalogRoutes);
  app.use('/api/v1/sessions', sessionRoutes);
  app.use('/api/v1/scan', scanRoutes);
  app.use('/api/v1/faculty', facultyRoutes);
  app.use('/api/v1/timetable', timetableRoutes);
  app.use('/api/v1/students', studentRoutes);
  app.use('/api/v1/history', historyRoutes);
  app.use('/api/v1/agent', agentRoutes);
  app.use('/api/v1/leave-requests', leaveRoutes);
  app.use('/api/attendance', attendanceRoutes);

  // Serve frontend static files in production
  if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}

