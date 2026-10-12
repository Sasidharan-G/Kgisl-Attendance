import http from 'http';
import { createApp } from './app';
import { initWebSocket } from './websocket/socket';
import { env } from './config/env';
import { logger } from './utils/logger';
import { resumeActiveSessions } from './services/session.service';
import { sweepExpiredQrHistory } from './services/qr.service';
import { flagFinishedBatchesForArchive } from './services/catalog.service';
import { prisma } from './config/prisma';
import { redis } from './config/redis';

const QR_SWEEP_INTERVAL_MS = 60_000;
const BATCH_CHECK_INTERVAL_MS = 60 * 60_000;

async function bootstrap() {
  const server = http.createServer(createApp());
  initWebSocket(server);
  await resumeActiveSessions();

  // Housekeeping only: Redis already governs live QR validation and the archive list is also checked on demand.
  const timers = [
    setInterval(() => {
      sweepExpiredQrHistory().catch((err) => logger.error('[sweeper] QR history sweep failed', { error: err.message }));
    }, QR_SWEEP_INTERVAL_MS),
    setInterval(() => {
      flagFinishedBatchesForArchive().catch((err) => logger.error('[sweeper] batch archive check failed', { error: err.message }));
    }, BATCH_CHECK_INTERVAL_MS),
  ];
  timers.forEach((timer) => timer.unref());
  flagFinishedBatchesForArchive().catch((err) => logger.error('[sweeper] batch archive check failed', { error: err.message }));

  server.listen(env.PORT, () => {
    logger.info(`KGiSL-IIM Attendance server listening on port ${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    timers.forEach(clearInterval);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    server.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error', { error: err.message, stack: err.stack });
  process.exit(1);
});
