import http from 'http';
import { createApp } from './app';
import { initWebSocket } from './websocket/socket';
import { env } from './config/env';
import { logger } from './utils/logger';
import { resumeActiveSessions } from './services/session.service';
import { sweepExpiredQrHistory } from './services/qr.service';
import { prisma } from './config/prisma';
import { redis } from './config/redis';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  initWebSocket(server);

  await resumeActiveSessions();

  // Housekeeping sweep for the audit table — Redis already governs live validation.
  const sweepTimer = setInterval(() => {
    sweepExpiredQrHistory().catch((err) => logger.error('[sweeper] failed', { error: err.message }));
  }, 30_000);
  sweepTimer.unref();

  server.listen(env.PORT, () => {
    logger.info(`🚀 KGiSL-IIM Attendance server listening on port ${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    clearInterval(sweepTimer);
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
