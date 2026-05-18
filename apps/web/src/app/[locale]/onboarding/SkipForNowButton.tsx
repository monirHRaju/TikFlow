'use client';

import { useTransition } from 'react';

import { Button } from '@tikflow/ui';

import { finishOnboardingAction } from './actions';

export function SkipForNowButton({ locale, label }: { locale: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => start(() => finishOnboardingAction(locale))}
    >
      {label}
    </Button>
  );
}
