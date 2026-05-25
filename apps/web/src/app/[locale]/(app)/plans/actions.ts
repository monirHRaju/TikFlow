'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { CreateServicePlanSchema, UpdateServicePlanSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import {
  ServicePlanError,
  archiveServicePlan,
  createServicePlan,
  updateServicePlan,
} from '@/lib/server/plans';

type FieldKey =
  | 'name'
  | 'code'
  | 'description'
  | 'type'
  | 'uploadKbps'
  | 'downloadKbps'
  | 'burstUploadKbps'
  | 'burstDownloadKbps'
  | 'validityDays'
  | 'price'
  | 'vatPct'
  | 'fupLimitGb'
  | 'fupThrottleKbps'
  | 'mikrotikProfile';

export type PlanMutationResult =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CODE_TAKEN' | 'IN_USE' | 'UNEXPECTED';
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

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = raw.toString().trim();
  if (s.length === 0) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = raw.toString().trim();
  return s.length === 0 ? null : s;
}

function parsePayload(formData: FormData) {
  return {
    name: str(formData, 'name') ?? '',
    code: (str(formData, 'code') ?? '').toUpperCase(),
    description: str(formData, 'description'),
    type: (str(formData, 'type') ?? 'pppoe') as 'pppoe' | 'hotspot' | 'static' | 'wireless',
    uploadKbps: num(formData, 'uploadKbps') ?? 0,
    downloadKbps: num(formData, 'downloadKbps') ?? 0,
    burstUploadKbps: num(formData, 'burstUploadKbps'),
    burstDownloadKbps: num(formData, 'burstDownloadKbps'),
    validityDays: num(formData, 'validityDays') ?? 30,
    price: num(formData, 'price') ?? 0,
    vatPct: num(formData, 'vatPct') ?? 0,
    fupLimitGb: num(formData, 'fupLimitGb'),
    fupThrottleKbps: num(formData, 'fupThrottleKbps'),
    mikrotikProfile: str(formData, 'mikrotikProfile'),
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  };
}

function flatErrors(error: import('zod').ZodError): Partial<Record<FieldKey, string[]>> {
  const flat = error.flatten().fieldErrors;
  const out: Partial<Record<FieldKey, string[]>> = {};
  for (const key of [
    'name',
    'code',
    'description',
    'type',
    'uploadKbps',
    'downloadKbps',
    'burstUploadKbps',
    'burstDownloadKbps',
    'validityDays',
    'price',
    'vatPct',
    'fupLimitGb',
    'fupThrottleKbps',
    'mikrotikProfile',
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

export async function createPlanAction(
  locale: string,
  _prev: PlanMutationResult | null,
  formData: FormData,
): Promise<PlanMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = CreateServicePlanSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };

  try {
    await createServicePlan(g.session, parsed.data, await meta());
    revalidatePath(`/${locale}/plans`);
    redirect(`/${locale}/plans`);
    return { ok: true };
  } catch (err) {
    if (isRedirect(err)) throw err;
    if (err instanceof ServicePlanError) return { ok: false, code: err.code, message: err.message };
    console.error('[plan.create]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function updatePlanAction(
  locale: string,
  planId: string,
  _prev: PlanMutationResult | null,
  formData: FormData,
): Promise<PlanMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = UpdateServicePlanSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };

  try {
    await updateServicePlan(g.session, planId, parsed.data, await meta());
    revalidatePath(`/${locale}/plans`);
    revalidatePath(`/${locale}/plans/${planId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ServicePlanError) return { ok: false, code: err.code, message: err.message };
    console.error('[plan.update]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function archivePlanAction(
  locale: string,
  planId: string,
): Promise<PlanMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };
  try {
    await archiveServicePlan(g.session, planId, await meta());
    revalidatePath(`/${locale}/plans`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ServicePlanError) return { ok: false, code: err.code, message: err.message };
    console.error('[plan.archive]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}
