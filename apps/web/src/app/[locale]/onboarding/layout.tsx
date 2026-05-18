import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';

import { Logo } from '@/components/Logo';
import { getOnboardingState } from '@/lib/server/onboarding';
import { hasAnyRole, requireSession } from '@/lib/server/session';
import { getBranding } from '@/lib/server/tenant';
import { BrandStyle } from '@/components/BrandStyle';

import { SkipForNowButton } from './SkipForNowButton';

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession(locale);

  const [branding, onboarding, isAdmin, t] = await Promise.all([
    getBranding(session),
    getOnboardingState(session),
    hasAnyRole(session, ['owner', 'admin']),
    getTranslations('onboarding'),
  ]);

  // Already done — there's nothing to wizard. Send them to the dashboard.
  if (onboarding.completedAt !== null) {
    redirect(`/${locale}`);
  }
  // Non-admin staff somehow on /onboarding — bounce to the dashboard
  // since they don't have permission to complete the steps anyway.
  if (!isAdmin) {
    redirect(`/${locale}`);
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,oklch(0.97_0_0),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,oklch(0.205_0_0),transparent_60%)]">
      <BrandStyle accentHex={branding.accentHex} />

      <header className="flex h-14 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur lg:px-8">
        <Logo logoUrl={branding.logoUrl} />
        <SkipForNowButton locale={locale} label={t('skipForNow')} />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 lg:py-12">
        {children}
      </main>
    </div>
  );
}
