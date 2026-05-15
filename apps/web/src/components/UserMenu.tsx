'use client';

import { LogOut, UserCircle } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { Button } from '@tikflow/ui';

export function UserMenu({ email }: { email: string }) {
  const t = useTranslations('nav');
  const [pending, startTransition] = useTransition();

  function onSignOut() {
    startTransition(async () => {
      await signOut({ callbackUrl: '/login' });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <UserCircle className="size-4" aria-hidden />
        <span className="max-w-[180px] truncate">{email}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('signOut')}
        onClick={onSignOut}
        disabled={pending}
      >
        <LogOut />
      </Button>
    </div>
  );
}
