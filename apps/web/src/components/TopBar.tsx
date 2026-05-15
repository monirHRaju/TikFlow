'use client';

import { Bell, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button, Input, ThemeToggle } from '@tikflow/ui';

import { UserMenu } from './UserMenu.js';

export function TopBar({ userEmail }: { userEmail: string }) {
  const t = useTranslations();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <div className="relative flex-1 max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder={t('common.search')}
          aria-label={t('common.search')}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
        <ThemeToggle label={t('nav.toggleTheme')} />
        <UserMenu email={userEmail} />
      </div>
    </header>
  );
}
