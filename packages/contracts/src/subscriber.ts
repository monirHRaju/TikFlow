import { z } from 'zod';

import { EmailSchema, PhoneSchema, UuidSchema } from './common.js';

export const SubscriberStatusSchema = z.enum(['pending', 'active', 'suspended', 'cancelled']);
export type SubscriberStatus = z.infer<typeof SubscriberStatusSchema>;

export const ConnectionTypeSchema = z.enum(['pppoe', 'hotspot', 'static']);
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

/**
 * Subscriber master record. `code` is what shows on bills and is used
 * for fuzzy search; `phone` is required because BD ISPs collect by
 * phone first, email later (or not at all). NID is stored plaintext
 * for MVP — a follow-up hardening PR adds column-level envelope
 * encryption (the column name already reflects this future state).
 */
export const CreateSubscriberSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'uppercase letters, digits, dashes only'),
  fullName: z.string().trim().min(2).max(120),
  fatherName: z.string().trim().max(120).nullable(),
  nidNumber: z.string().trim().max(40).nullable(),
  phone: PhoneSchema,
  altPhone: PhoneSchema.nullable(),
  email: EmailSchema.nullable(),
  address: z.string().trim().max(500).nullable(),
  zoneId: UuidSchema.nullable(),
  installationDate: z.string().date().nullable(),
  connectionType: ConnectionTypeSchema,
  notes: z.string().trim().max(1000).nullable(),
  planId: UuidSchema.nullable(),
});
export type CreateSubscriberInput = z.infer<typeof CreateSubscriberSchema>;

export const UpdateSubscriberSchema = CreateSubscriberSchema.extend({
  status: SubscriberStatusSchema,
});
export type UpdateSubscriberInput = z.infer<typeof UpdateSubscriberSchema>;

export const SubscriberSummarySchema = z.object({
  id: UuidSchema,
  code: z.string(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  status: SubscriberStatusSchema,
  connectionType: ConnectionTypeSchema,
  zone: z.object({ id: UuidSchema, name: z.string() }).nullable(),
  currentPlan: z
    .object({ id: UuidSchema, name: z.string(), price: z.number() })
    .nullable(),
  installationDate: z.string().date().nullable(),
  createdAt: z.string().datetime(),
});
export type SubscriberSummary = z.infer<typeof SubscriberSummarySchema>;

export const SubscriberDetailSchema = SubscriberSummarySchema.extend({
  fatherName: z.string().nullable(),
  nidNumber: z.string().nullable(),
  altPhone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
});
export type SubscriberDetail = z.infer<typeof SubscriberDetailSchema>;
