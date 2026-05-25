'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { CreateInventoryItemSchema, UpdateInventoryItemSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import {
  InventoryError,
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from '@/lib/server/inventory';

type FieldKey =
  | 'type'
  | 'status'
  | 'serial'
  | 'mac'
  | 'vendor'
  | 'model'
  | 'location'
  | 'subscriberId'
  | 'purchasedAt'
  | 'warrantyUntil'
  | 'cost'
  | 'notes';

export type InventoryMutationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'VALIDATION'
        | 'FORBIDDEN'
        | 'NOT_FOUND'
        | 'SERIAL_TAKEN'
        | 'UNKNOWN_SUBSCRIBER'
        | 'UNEXPECTED';
      fieldErrors?: Partial<Record<FieldKey, string[]>>;
      message?: string;
    };

async function meta() {
  const hdrs = await headers();
  return {
    ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null,
    userAgent: hdrs.get('user-agent') ?? null,
  };
}

async function gate(locale: string) {
  const session = await requireSession(locale);
  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) return { session: null, forbidden: true as const };
    throw err;
  }
  return { session, forbidden: false as const };
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = raw.toString().trim();
  return s.length === 0 ? null : s;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = raw.toString().trim();
  if (s.length === 0) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parsePayload(formData: FormData) {
  return {
    type: (str(formData, 'type') ?? 'other') as
      | 'ont'
      | 'onu'
      | 'router'
      | 'switch'
      | 'splitter'
      | 'cable_drum'
      | 'nic'
      | 'antenna'
      | 'other',
    status: (str(formData, 'status') ?? 'in_stock') as
      | 'in_stock'
      | 'allocated'
      | 'deployed'
      | 'faulty'
      | 'returned'
      | 'scrapped',
    serial: str(formData, 'serial'),
    mac: str(formData, 'mac'),
    vendor: str(formData, 'vendor'),
    model: str(formData, 'model'),
    location: str(formData, 'location'),
    subscriberId: str(formData, 'subscriberId'),
    purchasedAt: str(formData, 'purchasedAt'),
    warrantyUntil: str(formData, 'warrantyUntil'),
    cost: num(formData, 'cost'),
    notes: str(formData, 'notes'),
  };
}

function flatErrors(error: import('zod').ZodError): Partial<Record<FieldKey, string[]>> {
  const flat = error.flatten().fieldErrors;
  const out: Partial<Record<FieldKey, string[]>> = {};
  for (const key of [
    'type',
    'status',
    'serial',
    'mac',
    'vendor',
    'model',
    'location',
    'subscriberId',
    'purchasedAt',
    'warrantyUntil',
    'cost',
    'notes',
  ] as const) {
    if (flat[key]?.length) out[key] = flat[key];
  }
  return out;
}

function isRedirect(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export async function createInventoryAction(
  locale: string,
  _prev: InventoryMutationResult | null,
  formData: FormData,
): Promise<InventoryMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = CreateInventoryItemSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };

  try {
    await createInventoryItem(g.session, parsed.data, await meta());
    revalidatePath(`/${locale}/inventory`);
    redirect(`/${locale}/inventory`);
    return { ok: true };
  } catch (err) {
    if (isRedirect(err)) throw err;
    if (err instanceof InventoryError) return { ok: false, code: err.code, message: err.message };
    console.error('[inventory.create]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function updateInventoryAction(
  locale: string,
  itemId: string,
  _prev: InventoryMutationResult | null,
  formData: FormData,
): Promise<InventoryMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = UpdateInventoryItemSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };

  try {
    await updateInventoryItem(g.session, itemId, parsed.data, await meta());
    revalidatePath(`/${locale}/inventory`);
    revalidatePath(`/${locale}/inventory/${itemId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, code: err.code, message: err.message };
    console.error('[inventory.update]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function deleteInventoryAction(
  locale: string,
  itemId: string,
): Promise<InventoryMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };
  try {
    await deleteInventoryItem(g.session, itemId, await meta());
    revalidatePath(`/${locale}/inventory`);
    return { ok: true };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, code: err.code, message: err.message };
    console.error('[inventory.delete]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}
