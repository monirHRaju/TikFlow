import { type RequestHandler } from 'express';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

import { logger } from '../logger.js';
import { redis } from '../redis.js';

type LimiterOptions = {
  keyPrefix: string;
  points: number;
  duration?: number;
};

/**
 * Build a request handler that consumes one point per request, keyed by
 * `tenantId:ip`. Redis is the primary store; an in-memory insurance limiter
 * keeps the gate up if Redis is temporarily unreachable.
 */
export function rateLimit({ keyPrefix, points, duration = 60 }: LimiterOptions): RequestHandler {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
    insuranceLimiter: new RateLimiterMemory({ points, duration }),
  });

  return async (req, res, next) => {
    const key = `${req.tenantId ?? 'anon'}:${req.ip ?? 'unknown'}`;
    try {
      await limiter.consume(key);
      next();
    } catch (rlInfo) {
      const info = rlInfo as { msBeforeNext?: number };
      const retryAfter = Math.ceil((info.msBeforeNext ?? 1000) / 1000);
      res.setHeader('retry-after', String(retryAfter));
      logger.warn({ keyPrefix, key, retryAfter }, 'rate limit exceeded');
      res.status(429).json({ error: 'Too Many Requests', retryAfter });
    }
  };
}
