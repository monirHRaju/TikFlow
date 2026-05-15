import { env } from './env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';
import { redis } from './redis.js';
import { createServer } from './server.js';

export type { AppRouter } from './routers/_app.js';

const app = createServer();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'tikflow-api listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutdown initiated');
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'shutdown error');
      process.exitCode = 1;
    }
    try {
      await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    } finally {
      process.exit(process.exitCode ?? 0);
    }
  });
  // Hard cap — never hang the box.
  setTimeout(() => {
    logger.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception');
  process.exit(1);
});
