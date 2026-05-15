import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './env.js';
import { logger } from './logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { rateLimit } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { tenantContext } from './middleware/tenant-context.js';
import { appRouter } from './routers/_app.js';
import { healthzRouter } from './routes/healthz.js';
import { createContext } from './trpc.js';

export function createServer(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy (Coolify / load balancer) — trust the first hop
  // so req.ip reflects the real client IP for rate limiting.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // API is JSON-only; CSP is enforced at the web tier.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      allowedHeaders: [
        'content-type',
        'authorization',
        'x-csrf-token',
        'x-tenant-id',
        'x-request-id',
      ],
    }),
  );

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      autoLogging: { ignore: (req) => req.url === '/healthz' },
    }),
  );

  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(tenantContext);

  app.use(rateLimit({ keyPrefix: 'rl:global', points: 120, duration: 60 }));

  app.use(healthzRouter);

  app.use(
    '/trpc',
    rateLimit({ keyPrefix: 'rl:trpc', points: 60, duration: 60 }),
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
