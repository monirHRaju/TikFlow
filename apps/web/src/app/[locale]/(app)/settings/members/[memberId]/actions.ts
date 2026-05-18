'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { SetMemberStatusSchema, UpdateMemberRolesSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { MemberError, setMemberStatus, updateMemberRoles } from '@/lib/server/members';

export type MemberMutationResult =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'LAST_OWNER' | 'SELF_SUSPEND' | 'UNKNOWN_ROLE' | 'UNEXPECTED';
      message?: string;
    };

async function meta() {
  const hdrs = await headers();
  return {
    ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null,
    userAgent: hdrs.get('user-agent') ?? null,
  };
}

async function ensureAdmin(locale: string) {
  const session = await requireSession(locale);
  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) return { session: null, error: 'FORBIDDEN' as const };
    throw err;
  }
  return { session, error: null };
}

function memberErrorToResult(err: MemberError): MemberMutationResult {
  return { ok: false, code: err.code, message: err.message };
}

export async function updateMemberRolesAction(
  locale: string,
  memberId: string,
  formData: FormData,
): Promise<MemberMutationResult> {
  const { session, error } = await ensureAdmin(locale);
  if (error) return { ok: false, code: 'FORBIDDEN' };

  const parsed = UpdateMemberRolesSchema.safeParse({
    roleIds: formData.getAll('roleIds').map((v) => v.toString()),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: parsed.error.errors[0]?.message ?? 'invalid input',
    };
  }

  try {
    await updateMemberRoles(session, memberId, parsed.data, await meta());
  } catch (err) {
    if (err instanceof MemberError) return memberErrorToResult(err);
    console.error('[members.roles.update] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
  revalidatePath(`/${locale}/settings/members`, 'layout');
  return { ok: true };
}

export async function setMemberStatusAction(
  locale: string,
  memberId: string,
  formData: FormData,
): Promise<MemberMutationResult> {
  const { session, error } = await ensureAdmin(locale);
  if (error) return { ok: false, code: 'FORBIDDEN' };

  const parsed = SetMemberStatusSchema.safeParse({
    status: (formData.get('status') ?? '').toString(),
  });
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION', message: parsed.error.errors[0]?.message };
  }

  try {
    await setMemberStatus(session, memberId, parsed.data, await meta());
  } catch (err) {
    if (err instanceof MemberError) return memberErrorToResult(err);
    console.error('[members.status] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }
  revalidatePath(`/${locale}/settings/members`, 'layout');
  return { ok: true };
}
