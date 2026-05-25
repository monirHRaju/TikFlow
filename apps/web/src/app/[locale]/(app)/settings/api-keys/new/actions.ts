'use server';

import { headers } from 'next/headers';

import { CreateApiKeySchema, type CreatedApiKey } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { ApiKeyError, createApiKey } from '@/lib/server/api-keys';

type FieldKey = 'label' | 'scopes' | 'expiresAt';

export type CreateApiKeyResult =
  | { ok: true; created: CreatedApiKey }
  | {
      ok: false;
      code: 'VALIDATION' | 'FORBIDDEN' | 'HASH_COLLISION' | 'UNEXPECTED';
      fieldErrors?: Partial<Record<FieldKey, string[]>>;
    };

export async function createApiKeyAction(
  locale: string,
  formData: FormData,
): Promise<CreateApiKeyResult> {
  const session = await requireSession(locale);
  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, code: 'FORBIDDEN' };
    throw err;
  }

  const rawExpires = (formData.get('expiresAt') ?? '').toString().trim();
  // The form sends `YYYY-MM-DD`; normalise to end-of-day UTC ISO so the
  // key is valid for the whole picked day.
  let expiresAt: string | null = null;
  if (rawExpires.length > 0) {
    const d = new Date(`${rawExpires}T23:59:59.000Z`);
    if (!Number.isNaN(d.getTime())) {
      expiresAt = d.toISOString();
    }
  }

  const parsed = CreateApiKeySchema.safeParse({
    label: (formData.get('label') ?? '').toString(),
    scopes: formData.getAll('scopes').map((v) => v.toString()),
    expiresAt,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<FieldKey, string[]>> = {};
    for (const key of ['label', 'scopes', 'expiresAt'] as const) {
      if (flat[key]?.length) fieldErrors[key] = flat[key];
    }
    return { ok: false, code: 'VALIDATION', fieldErrors };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    const created = await createApiKey(session, parsed.data, { ip, userAgent });
    return { ok: true, created };
  } catch (err) {
    if (err instanceof ApiKeyError && err.code === 'HASH_COLLISION') {
      return { ok: false, code: 'HASH_COLLISION' };
    }
    console.error('[apikey.create] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
}
