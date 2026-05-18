'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { completeOnboarding } from '@/lib/server/onboarding';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';

/**
 * Mark onboarding finished for the current tenant and bounce the
 * caller to the dashboard. Used both by the "Skip for now" header
 * shortcut and by the explicit "Finish" button on the last step.
 */
export async function finishOnboardingAction(locale: string): Promise<void> {
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect(`/${locale}`);
    }
    throw err;
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  await completeOnboarding(session, { ip, userAgent });

  redirect(`/${locale}`);
}
