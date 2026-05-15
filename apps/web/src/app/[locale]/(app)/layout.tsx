import { type ReactNode } from 'react';

import { Sidebar } from '@/components/Sidebar.js';
import { TopBar } from '@/components/TopBar.js';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  // PR-0.5 will add an Auth.js session check here that redirects
  // unauthenticated requests to /<locale>/login.
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
