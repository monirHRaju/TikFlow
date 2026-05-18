'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { WeakPasswordError } from '@tikflow/auth';
import { CreateMemberSchema } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { MemberError, createMember } from '@/lib/server/members';

type FieldKey = 'email' | 'password' | 'roleIds';

export type CreateMemberResult =
  | { ok: true; memberId: string }
  | {
      ok: false;
      code:
        | 'VALIDATION'
        | 'FORBIDDEN'
        | 'EMAIL_TAKEN'
        | 'WEAK_PASSWORD'
        | 'UNKNOWN_ROLE'
        | 'UNEXPECTED';
      fieldErrors?: Partial<Record<FieldKey, string[]>>;
    };

export async function createMemberAction(
  locale: string,
  formData: FormData,
): Promise<CreateMemberResult> {
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, code: 'FORBIDDEN' };
    throw err;
  }

  const parsed = CreateMemberSchema.safeParse({
    email: (formData.get('email') ?? '').toString(),
    password: (formData.get('password') ?? '').toString(),
    roleIds: formData.getAll('roleIds').map((v) => v.toString()),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<FieldKey, string[]>> = {};
    for (const key of ['email', 'password', 'roleIds'] as const) {
      if (flat[key]?.length) fieldErrors[key] = flat[key];
    }
    return { ok: false, code: 'VALIDATION', fieldErrors };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  let memberId: string;
  try {
    const member = await createMember(session, parsed.data, { ip, userAgent });
    memberId = member.id;
  } catch (err) {
    if (err instanceof WeakPasswordError) {
      return {
        ok: false,
        code: 'WEAK_PASSWORD',
        fieldErrors: { password: [err.message] },
      };
    }
    if (err instanceof MemberError) {
      switch (err.code) {
        case 'EMAIL_TAKEN':
          return { ok: false, code: 'EMAIL_TAKEN', fieldErrors: { email: [err.message] } };
        case 'UNKNOWN_ROLE':
          return { ok: false, code: 'UNKNOWN_ROLE', fieldErrors: { roleIds: [err.message] } };
        default:
          break;
      }
    }
    console.error('[members.create] failed', err);
    return { ok: false, code: 'UNEXPECTED' };
  }

  redirect(`/${locale}/settings/members/${memberId}?welcome=1`);
}
