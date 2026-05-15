'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button, Input, Label } from '@tikflow/ui';

export function LoginForm() {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Auth wiring lands in PR-0.5; this is a UI-only stub.
    setPending(true);
    setTimeout(() => {
      setPending(false);
    }, 600);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t('emailPlaceholder')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder={t('passwordPlaceholder')}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? t('signingIn') : t('signInButton')}
      </Button>
    </form>
  );
}
