import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  REQUEST_BODY_LIMIT: z.string().default('100kb'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // We use console here because the logger itself needs env to be valid.
  console.error('[env] invalid configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof schema>;
