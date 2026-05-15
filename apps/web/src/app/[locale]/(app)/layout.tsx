import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { auth } from '@/auth';
import { Sidebar } from '@/components/Sidebar.js';
import { TopBar } from '@/components/TopBar.js';

export default async function AppShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar userEmail={session.user.email ?? ''} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
