import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.boolean(),
  cache: z.boolean(),
  ts: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
