import { z } from 'zod';

import { SlugSchema, UuidSchema } from './common.js';

export const CreateZoneSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: SlugSchema,
  parentId: UuidSchema.nullable(),
  description: z.string().trim().max(500).nullable(),
});
export type CreateZoneInput = z.infer<typeof CreateZoneSchema>;

export const UpdateZoneSchema = CreateZoneSchema;
export type UpdateZoneInput = z.infer<typeof UpdateZoneSchema>;

export const ZoneSummarySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  parentId: UuidSchema.nullable(),
  parentName: z.string().nullable(),
  subscriberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ZoneSummary = z.infer<typeof ZoneSummarySchema>;
