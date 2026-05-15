import Redis from 'ioredis';

import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err: unknown) => {
  logger.error({ err }, 'redis error');
});

redis.on('connect', () => {
  logger.info('redis connected');
});
