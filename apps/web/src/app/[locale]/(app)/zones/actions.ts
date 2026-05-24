'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { CreateZoneSchema, UpdateZoneSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { ZoneError, createZone, deleteZone, updateZone } from '@/lib/server/zones';

type FieldKey = 'name' | 'slug' | 'parentId' | 'description';

export type ZoneMutationResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      code: 'VALIDATION' | 'FORBIDDEN' | 'SLUG_TAKEN' | 'NOT_FOUND' | 'IN_USE' | 'PARENT_CYCLE' | 'UNEXPECTED';
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

function parseField(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const trimmed = raw.toString().trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createZoneAction(
  locale: string,
  _prev: ZoneMutationResult | null,
  formData: FormData,
): Promise<ZoneMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = CreateZoneSchema.safeParse({
    name: parseField(formData, 'name') ?? '',
    slug: parseField(formData, 'slug') ?? '',
    parentId: parseField(formData, 'parentId'),
    description: parseField(formData, 'description'),
  });
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };
  }

  try {
    const created = await createZone(g.session, parsed.data, await meta());
    revalidatePath(`/${locale}/zones`);
    redirect(`/${locale}/zones`);
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof ZoneError) return { ok: false, code: err.code, message: err.message };
    if (isRedirect(err)) throw err;
    console.error('[zone.create]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function updateZoneAction(
  locale: string,
  zoneId: string,
  _prev: ZoneMutationResult | null,
  formData: FormData,
): Promise<ZoneMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  const parsed = UpdateZoneSchema.safeParse({
    name: parseField(formData, 'name') ?? '',
    slug: parseField(formData, 'slug') ?? '',
    parentId: parseField(formData, 'parentId'),
    description: parseField(formData, 'description'),
  });
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION', fieldErrors: flatErrors(parsed.error) };
  }

  try {
    await updateZone(g.session, zoneId, parsed.data, await meta());
    revalidatePath(`/${locale}/zones`);
    revalidatePath(`/${locale}/zones/${zoneId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ZoneError) return { ok: false, code: err.code, message: err.message };
    console.error('[zone.update]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

export async function deleteZoneAction(
  locale: string,
  zoneId: string,
): Promise<ZoneMutationResult> {
  const g = await gate(locale);
  if (g.forbidden) return { ok: false, code: 'FORBIDDEN' };

  try {
    await deleteZone(g.session, zoneId, await meta());
    revalidatePath(`/${locale}/zones`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ZoneError) return { ok: false, code: err.code, message: err.message };
    console.error('[zone.delete]', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

function flatErrors(error: import('zod').ZodError): Partial<Record<FieldKey, string[]>> {
  const flat = error.flatten().fieldErrors;
  const out: Partial<Record<FieldKey, string[]>> = {};
  for (const key of ['name', 'slug', 'parentId', 'description'] as const) {
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
