import { type ReactNode } from 'react';

import { BrandStyle } from '@/components/BrandStyle';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { requireSession } from '@/lib/server/session';
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
  const branding = await getBranding(session);

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
