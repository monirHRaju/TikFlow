'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';

import { Button, Input, Label } from '@tikflow/ui';

import { signInWithCredentials } from './actions.js';

type Stage = 'credentials' | 'mfa';

export function LoginForm({ defaultTenantSlug }: { defaultTenantSlug?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>('credentials');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tenantSlug: defaultTenantSlug ?? '',
    email: '',
    password: '',
    otp: '',
  });

  function update<K extends keyof typeof form>(key: K) {
    return (e: { target: { value: string } }) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signInWithCredentials({
        tenantSlug: form.tenantSlug.trim(),
        email: form.email.trim(),
        password: form.password,
        otp: form.otp.trim() || undefined,
      });

      if (result.ok) {
        router.replace('/');
        router.refresh();
        return;
      }

      if (result.code === 'MFA_REQUIRED') {
        setStage('mfa');
        return;
      }

      setError(errorMessage(result.code, t));
    });
  }

  if (stage === 'mfa') {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp">{t('auth.mfaCode')}</Label>
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={form.otp}
            onChange={update('otp')}
          />
          <p className="text-xs text-muted-foreground">{t('auth.mfaSubtitle')}</p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? t('auth.signingIn') : t('auth.verifyButton')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tenantSlug">{t('auth.tenantSlug')}</Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          autoComplete="organization"
          required
          placeholder={t('auth.tenantSlugPlaceholder')}
          value={form.tenantSlug}
          onChange={update('tenantSlug')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t('auth.emailPlaceholder')}
          value={form.email}
          onChange={update('email')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder={t('auth.passwordPlaceholder')}
          value={form.password}
          onChange={update('password')}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t('auth.signingIn') : t('auth.signInButton')}
      </Button>
    </form>
  );
}

function errorMessage(code: string, t: ReturnType<typeof useTranslations>): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return t('auth.errors.invalidCredentials');
    case 'ACCOUNT_LOCKED':
      return t('auth.errors.accountLocked');
    case 'ACCOUNT_INACTIVE':
      return t('auth.errors.accountInactive');
    default:
      return t('auth.errors.unexpected');
  }
}
