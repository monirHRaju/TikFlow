'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { ApiKeyError, revokeApiKey } from '@/lib/server/api-keys';

export type RevokeResult =
  | { ok: true }
  | { ok: false; code: 'FORBIDDEN' | 'NOT_FOUND' | 'UNEXPECTED' };

export async function revokeApiKeyAction(
  locale: string,
  apiKeyId: string,
): Promise<RevokeResult> {
  const session = await requireSession(locale);
  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, code: 'FORBIDDEN' };
    throw err;
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await revokeApiKey(session, apiKeyId, { ip, userAgent });
  } catch (err) {
    if (err instanceof ApiKeyError && err.code === 'NOT_FOUND') {
      return { ok: false, code: 'NOT_FOUND' };
    }
    console.error('[apikey.revoke] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
  revalidatePath(`/${locale}/settings/api-keys`);
  return { ok: true };
}
