'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { CreateSubscriberSchema, UpdateSubscriberSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import {
  SubscriberError,
  createSubscriber,
  deleteSubscriber,
  updateSubscriber,
} from '@/lib/server/subscribers';

type FieldKey =
  | 'code'
  | 'fullName'
  | 'fatherName'
  | 'nidNumber'
  | 'phone'
  | 'altPhone'
  | 'email'
  | 'address'
  | 'zoneId'
  | 'installationDate'
  | 'connectionType'
  | 'planId'
  | 'status'
  | 'notes';

export type SubscriberMutationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'VALIDATION'
        | 'FORBIDDEN'
        | 'NOT_FOUND'
        | 'CODE_TAKEN'
        | 'UNKNOWN_ZONE'
        | 'UNKNOWN_PLAN'
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

function flatErrors(error: import('zod').ZodError): Partial<Record<FieldKey, string[]>> {
  const flat = error.flatten().fieldErrors;
  const out: Partial<Record<FieldKey, string[]>> = {};
  for (const key of [
    'code',
    'fullName',
    'fatherName',
    'nidNumber',
    'phone',
    'altPhone',
    'email',
    'address',
    'zoneId',
    'installationDate',
    'connectionType',
    'planId',
    'status',
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

function parseCreate(formData: FormData) {
  return {
    code: (str(formData, 'code') ?? '').toUpperCase(),
    fullName: str(formData, 'fullName') ?? '',
    fatherName: str(formData, 'fatherName'),
    nidNumber: str(formData, 'nidNumber'),
    phone: str(formData, 'phone') ?? '',
    altPhone: str(formData, 'altPhone'),
    email: str(formData, 'email'),
    address: str(formData, 'address'),
    zoneId: str(formData, 'zoneId'),
    installationDate: str(formData, 'installationDate'),
    connectionType: (str(formData, 'connectionType') ?? 'pppoe') as 'pppoe' | 'hotspot' | 'static',
    notes: str(formData, 'notes'),
    planId: str(formData, 'planId'),
  };
}

export async function createSubscriberAction(
  locale: string,
  _prev: SubscriberMutationResult | null,
  formData: FormData,
): Promise<SubscriberMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = CreateSubscriberSchema.safeParse(parseCreate(formData));
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };

  try {
    await createSubscriber(g.session, parsed.data, await meta());
    revalidatePath(`/${locale}/subscribers`);
    redirect(`/${locale}/subscribers`);
    return { ok: true };
  } catch (err) {
    if (isRedirect(err)) throw err;
    if (err instanceof SubscriberError) return { ok: false, code: err.code, message: err.message };
    console.error('[subscriber.create]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function updateSubscriberAction(
  locale: string,
  subscriberId: string,
  _prev: SubscriberMutationResult | null,
  formData: FormData,
): Promise<SubscriberMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = UpdateSubscriberSchema.safeParse({
    ...parseCreate(formData),
    status: (str(formData, 'status') ?? 'pending') as
      | 'pending'
      | 'active'
      | 'suspended'
      | 'cancelled',
  });
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };

  try {
    await updateSubscriber(g.session, subscriberId, parsed.data, await meta());
    revalidatePath(`/${locale}/subscribers`);
    revalidatePath(`/${locale}/subscribers/${subscriberId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof SubscriberError) return { ok: false, code: err.code, message: err.message };
    console.error('[subscriber.update]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function deleteSubscriberAction(
  locale: string,
  subscriberId: string,
): Promise<SubscriberMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };
  try {
    await deleteSubscriber(g.session, subscriberId, await meta());
    revalidatePath(`/${locale}/subscribers`);
    return { ok: true };
  } catch (err) {
    if (err instanceof SubscriberError) return { ok: false, code: err.code, message: err.message };
    console.error('[subscriber.delete]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}
