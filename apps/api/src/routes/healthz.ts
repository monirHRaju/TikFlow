import { Router, type Request, type Response } from 'express';

import { prisma } from '../prisma.js';
import { redis } from '../redis.js';

export const healthzRouter = Router();

healthzRouter.get('/healthz', async (_req: Request, res: Response) => {
  const checks = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()]);

  const db = checks[0].status === 'fulfilled';
  const cache = checks[1].status === 'fulfilled';
  const healthy = db && cache;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db,
    cache,
    ts: new Date().toISOString(),
  });
});
