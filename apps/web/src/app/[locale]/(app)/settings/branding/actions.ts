'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { TenantBrandingSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { updateBranding } from '@/lib/server/tenant';

type FieldKey = 'accentHex' | 'logoUrl' | 'invoicePrefix' | 'invoiceHeader' | 'invoiceFooter';

export type UpdateBrandingResult =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION' | 'FORBIDDEN' | 'UNEXPECTED';
      fieldErrors?: Partial<Record<FieldKey, string[]>>;
    };

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = value.toString().trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function updateBrandingAction(
  locale: string,
  formData: FormData,
): Promise<UpdateBrandingResult> {
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, code: 'FORBIDDEN' };
    }
    throw err;
  }

  const parsed = TenantBrandingSchema.safeParse({
    accentHex: emptyToNull(formData.get('accentHex'))?.toLowerCase() ?? null,
    logoUrl: emptyToNull(formData.get('logoUrl')),
    invoicePrefix: emptyToNull(formData.get('invoicePrefix'))?.toUpperCase() ?? null,
    invoiceHeader: emptyToNull(formData.get('invoiceHeader')),
    invoiceFooter: emptyToNull(formData.get('invoiceFooter')),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<FieldKey, string[]>> = {};
    for (const key of ['accentHex', 'logoUrl', 'invoicePrefix', 'invoiceHeader', 'invoiceFooter'] as const) {
      if (flat[key]?.length) fieldErrors[key] = flat[key];
    }
    return { ok: false, code: 'VALIDATION', fieldErrors };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await updateBranding(session, parsed.data, { ip, userAgent });
  } catch (err) {
    console.error('[settings.branding.update] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }

  revalidatePath(`/${locale}`, 'layout');
  return { ok: true };
}
