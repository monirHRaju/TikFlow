import { z } from 'zod';

import { UuidSchema } from './common.js';

/**
 * Available API key scopes. These are a curated subset of the system
 * permission catalogue — only the resources that already make sense to
 * grant to an out-of-app integrator (read-side mostly). More scopes get
 * added as new resources land (subscribers, invoices, etc.).
 */
export const API_KEY_SCOPES = [
  'tenant.read',
  'user.read',
  'role.read',
  'apikey.read',
  'audit.read',
  'security.read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const ApiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export const CreateApiKeySchema = z.object({
  label: z.string().trim().min(2).max(80),
  scopes: z.array(ApiKeyScopeSchema).min(1, 'pick at least one scope'),
  /**
   * Optional ISO datetime in the future. When omitted the key never
   * expires (admins are encouraged to set 90 / 180 / 365-day rotations).
   */
  expiresAt: z
    .string()
    .datetime()
    .nullable()
    .refine((v) => v === null || new Date(v).getTime() > Date.now(), 'expiry must be in the future'),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

export const ApiKeySummarySchema = z.object({
  id: UuidSchema,
  label: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ApiKeySummary = z.infer<typeof ApiKeySummarySchema>;

/**
 * Returned exactly once at creation time. The `plaintext` field is never
 * persisted or fetched again — the admin sees it in the success panel
 * and copies it out-of-band.
 */
export const CreatedApiKeySchema = ApiKeySummarySchema.extend({
  plaintext: z.string().min(20),
});
export type CreatedApiKey = z.infer<typeof CreatedApiKeySchema>;
