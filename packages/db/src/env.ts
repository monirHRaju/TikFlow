import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_MIGRATE_URL: z.string().url().optional(),
});

export const dbEnv = schema.parse(process.env);

export type DbEnv = z.infer<typeof schema>;
