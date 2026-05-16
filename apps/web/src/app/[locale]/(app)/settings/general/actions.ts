'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { TenantGeneralSettingsSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { updateGeneralSettings } from '@/lib/server/tenant';
import { isSupportedCurrency, isSupportedTimezone } from '@/lib/server/reference-data';

export type UpdateGeneralResult =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION' | 'FORBIDDEN' | 'UNEXPECTED';
      fieldErrors?: Partial<Record<'name' | 'billingEmail' | 'timezone' | 'currency', string[]>>;
    };

export async function updateGeneralSettingsAction(
  locale: string,
  formData: FormData,
): Promise<UpdateGeneralResult> {
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, code: 'FORBIDDEN' };
    }
    throw err;
  }

  const billingEmailRaw = (formData.get('billingEmail') ?? '').toString().trim();

  const parsed = TenantGeneralSettingsSchema.safeParse({
    name: (formData.get('name') ?? '').toString(),
    billingEmail: billingEmailRaw.length === 0 ? null : billingEmailRaw,
    timezone: (formData.get('timezone') ?? '').toString(),
    currency: (formData.get('currency') ?? '').toString().toUpperCase(),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Server-side closed-set validation — the dropdowns are convenience UX,
  // not the source of truth for what we accept.
  const fieldErrors: NonNullable<Extract<UpdateGeneralResult, { ok: false }>['fieldErrors']> = {};
  if (!isSupportedTimezone(parsed.data.timezone)) {
    fieldErrors.timezone = ['Unsupported timezone'];
  }
  if (!isSupportedCurrency(parsed.data.currency)) {
    fieldErrors.currency = ['Unsupported currency'];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, code: 'VALIDATION', fieldErrors };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await updateGeneralSettings(session, parsed.data, { ip, userAgent });
  } catch (err) {
    console.error('[settings.general.update] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }

  revalidatePath(`/${locale}/settings/general`);
  return { ok: true };
}
