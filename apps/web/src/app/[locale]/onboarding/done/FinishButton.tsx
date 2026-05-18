'use client';

import { useTransition } from 'react';
import { LayoutDashboard } from 'lucide-react';

import { Button } from '@tikflow/ui';

import { finishOnboardingAction } from '../actions';

export function FinishButton({
  locale,
  label,
  pendingLabel,
  icon,
}: {
  locale: string;
  label: string;
  pendingLabel: string;
  icon?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => start(() => finishOnboardingAction(locale))}
    >
      {icon ? <LayoutDashboard className="size-4" aria-hidden /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}
