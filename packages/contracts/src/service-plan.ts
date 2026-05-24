import { z } from 'zod';

import { UuidSchema } from './common.js';

export const ServicePlanTypeSchema = z.enum(['pppoe', 'hotspot', 'static', 'wireless']);
export type ServicePlanType = z.infer<typeof ServicePlanTypeSchema>;

/**
 * Up/download speeds are stored in kbps (a 10 Mbps plan = 10_000).
 * VAT is a percentage 0-100. `price` is a positive decimal, the
 * currency comes from `tenants.currency`.
 */
export const CreateServicePlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'uppercase letters, digits, dashes, underscores'),
  description: z.string().trim().max(500).nullable(),
  type: ServicePlanTypeSchema,
  uploadKbps: z.number().int().positive().max(10_000_000),
  downloadKbps: z.number().int().positive().max(10_000_000),
  burstUploadKbps: z.number().int().positive().nullable(),
  burstDownloadKbps: z.number().int().positive().nullable(),
  validityDays: z.number().int().min(1).max(3650),
  price: z.number().nonnegative().max(10_000_000),
  vatPct: z.number().min(0).max(100),
  fupLimitGb: z.number().int().positive().nullable(),
  fupThrottleKbps: z.number().int().positive().nullable(),
  mikrotikProfile: z.string().trim().max(120).nullable(),
  isActive: z.boolean(),
});
export type CreateServicePlanInput = z.infer<typeof CreateServicePlanSchema>;

export const UpdateServicePlanSchema = CreateServicePlanSchema;
export type UpdateServicePlanInput = z.infer<typeof UpdateServicePlanSchema>;

export const ServicePlanSummarySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  type: ServicePlanTypeSchema,
  uploadKbps: z.number().int(),
  downloadKbps: z.number().int(),
  price: z.number(),
  vatPct: z.number(),
  validityDays: z.number().int(),
  isActive: z.boolean(),
  subscriberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ServicePlanSummary = z.infer<typeof ServicePlanSummarySchema>;

export const ServicePlanDetailSchema = ServicePlanSummarySchema.extend({
  burstUploadKbps: z.number().int().nullable(),
  burstDownloadKbps: z.number().int().nullable(),
  fupLimitGb: z.number().int().nullable(),
  fupThrottleKbps: z.number().int().nullable(),
  mikrotikProfile: z.string().nullable(),
});
export type ServicePlanDetail = z.infer<typeof ServicePlanDetailSchema>;
