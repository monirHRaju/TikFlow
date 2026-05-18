import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { BrandStyle } from '@/components/BrandStyle';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { getOnboardingState } from '@/lib/server/onboarding';
import { hasAnyRole, requireSession } from '@/lib/server/session';
import { getBranding } from '@/lib/server/tenant';

export default async function AppShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await requireSession(locale);

  // First-run gate: if the workspace hasn't finished onboarding *and*
  // this user can actually drive it, push them into the wizard. Non-
  // privileged staff who somehow log in before onboarding finishes still
  // see the app shell — they shouldn't be forced through a wizard they
  // can't complete.
  const [branding, onboarding, isAdmin] = await Promise.all([
    getBranding(session),
    getOnboardingState(session),
    hasAnyRole(session, ['owner', 'admin']),
  ]);

  if (onboarding.completedAt === null && isAdmin) {
    redirect(`/${locale}/onboarding/welcome`);
  }

  return (
    <div className="flex min-h-screen w-full">
      <BrandStyle accentHex={branding.accentHex} />
      <Sidebar logoUrl={branding.logoUrl} />
      <div className="flex flex-1 flex-col">
        <TopBar userEmail={session.email} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
