import { z } from 'zod';

import { EmailSchema, SlugSchema } from './common.js';

/**
 * Tenant general settings (the writeable subset of the tenants table that
 * an owner / admin can edit from /settings/general).
 *
 * Country and currency are ISO codes; timezone is an IANA name. We don't
 * trust the client to pick a sensible value, so the lists are constrained
 * server-side in the action.
 */
export const TenantGeneralSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  billingEmail: EmailSchema.nullable(),
  timezone: z
    .string()
    .min(3)
    .max(64)
    // IANA tz names: Area/City, optionally Area/SubArea/City. We just
    // sanity-check the shape; full validation happens server-side via
    // Intl.supportedValuesOf('timeZone').
    .regex(/^[A-Za-z][A-Za-z0-9_+\-]*\/[A-Za-z0-9_+\-/]+$|^UTC$/, 'expected IANA timezone'),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'expected ISO 4217 currency code'),
});
export type TenantGeneralSettings = z.infer<typeof TenantGeneralSettingsSchema>;

/**
 * Tenant summary returned to the settings UI. Slug is read-only after
 * provisioning (changing it would break magic links, signed URLs, etc.).
 */
export const TenantSummarySchema = z.object({
  id: z.string().uuid(),
  slug: SlugSchema,
  name: z.string(),
  billingEmail: z.string().email().nullable(),
  timezone: z.string(),
  currency: z.string(),
  country: z.string().length(2),
  plan: z.enum(['trial', 'standard', 'pro']),
  status: z.enum(['active', 'suspended', 'closed']),
});
export type TenantSummary = z.infer<typeof TenantSummarySchema>;

/**
 * Tenant branding. Stored as the full `tenants.branding` JSON document.
 * All fields are optional — an empty workspace renders TikFlow defaults.
 *
 * Hex colour is validated tightly (no `rgb()`, no shorthand) because the
 * value is injected into a `<style>` block at render time. The render-time
 * validator double-checks the shape before emitting CSS.
 */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB hex colour');

export const TenantBrandingSchema = z.object({
  accentHex: HexColorSchema.nullable(),
  logoUrl: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith('https://'), 'logo URL must be https')
    .nullable(),
  invoicePrefix: z
    .string()
    .trim()
    .max(10)
    .regex(/^[A-Z0-9-]*$/, 'uppercase letters, digits, and hyphens only')
    .nullable(),
  invoiceHeader: z.string().trim().max(1000).nullable(),
  invoiceFooter: z.string().trim().max(1000).nullable(),
});
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export const DEFAULT_BRANDING: TenantBranding = {
  accentHex: null,
  logoUrl: null,
  invoicePrefix: null,
  invoiceHeader: null,
  invoiceFooter: null,
};
