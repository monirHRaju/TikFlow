import { z } from 'zod';

import { UuidSchema } from './common.js';

export const InventoryItemTypeSchema = z.enum([
  'ont',
  'onu',
  'router',
  'switch',
  'splitter',
  'cable_drum',
  'nic',
  'antenna',
  'other',
]);
export type InventoryItemType = z.infer<typeof InventoryItemTypeSchema>;

export const InventoryItemStatusSchema = z.enum([
  'in_stock',
  'allocated',
  'deployed',
  'faulty',
  'returned',
  'scrapped',
]);
export type InventoryItemStatus = z.infer<typeof InventoryItemStatusSchema>;

const MAC_RE = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

export const CreateInventoryItemSchema = z.object({
  type: InventoryItemTypeSchema,
  status: InventoryItemStatusSchema,
  serial: z.string().trim().max(80).nullable(),
  mac: z
    .string()
    .trim()
    .nullable()
    .refine((v) => v === null || v.length === 0 || MAC_RE.test(v), 'expected AA:BB:CC:DD:EE:FF'),
  vendor: z.string().trim().max(80).nullable(),
  model: z.string().trim().max(120).nullable(),
  location: z.string().trim().max(200).nullable(),
  subscriberId: UuidSchema.nullable(),
  purchasedAt: z.string().date().nullable(),
  warrantyUntil: z.string().date().nullable(),
  cost: z.number().nonnegative().nullable(),
  notes: z.string().trim().max(1000).nullable(),
});
export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;

export const UpdateInventoryItemSchema = CreateInventoryItemSchema;
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;

export const InventoryItemSummarySchema = z.object({
  id: UuidSchema,
  type: InventoryItemTypeSchema,
  status: InventoryItemStatusSchema,
  serial: z.string().nullable(),
  mac: z.string().nullable(),
  vendor: z.string().nullable(),
  model: z.string().nullable(),
  location: z.string().nullable(),
  subscriber: z.object({ id: UuidSchema, code: z.string(), fullName: z.string() }).nullable(),
  purchasedAt: z.string().date().nullable(),
  warrantyUntil: z.string().date().nullable(),
  cost: z.number().nullable(),
  createdAt: z.string().datetime(),
});
export type InventoryItemSummary = z.infer<typeof InventoryItemSummarySchema>;
