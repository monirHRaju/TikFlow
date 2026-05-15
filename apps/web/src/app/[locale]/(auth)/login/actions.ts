'use server';

import { signIn, TikflowAuthError } from '@/auth';

export type SignInResult = { ok: true } | { ok: false; code: string };

export async function signInWithCredentials(input: {
  tenantSlug: string;
  email: string;
  password: string;
  otp?: string;
}): Promise<SignInResult> {
  try {
    await signIn('credentials', {
      tenantSlug: input.tenantSlug,
      email: input.email,
      password: input.password,
      otp: input.otp ?? '',
      redirect: false,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof TikflowAuthError) {
      return { ok: false, code: err.code };
    }
    // Auth.js may also wrap our error in a generic CredentialsSignin;
    // surface a non-revealing fallback.
    if (err && typeof err === 'object' && 'type' in err && err.type === 'CredentialsSignin') {
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    return { ok: false, code: 'UNEXPECTED_ERROR' };
  }
}
