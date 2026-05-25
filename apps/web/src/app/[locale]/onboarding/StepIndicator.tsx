import { Check } from 'lucide-react';

import { cn } from '@tikflow/ui';

import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/server/onboarding';

const VISIBLE_STEPS: ReadonlyArray<OnboardingStep> = ['general', 'branding', 'team', 'done'];

type LabelMap = Record<(typeof VISIBLE_STEPS)[number], string>;

export function StepIndicator({
  current,
  labels,
}: {
  current: OnboardingStep;
  labels: LabelMap;
}) {
  const currentIdx = ONBOARDING_STEPS.indexOf(current);

  return (
    <ol className="flex items-center gap-2 text-sm">
      {VISIBLE_STEPS.map((step, i) => {
        const stepIdx = ONBOARDING_STEPS.indexOf(step);
        const status: 'done' | 'current' | 'upcoming' =
          stepIdx < currentIdx ? 'done' : stepIdx === currentIdx ? 'current' : 'upcoming';

        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-current={status === 'current' ? 'step' : undefined}
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                status === 'done' && 'border-primary bg-primary text-primary-foreground',
                status === 'current' && 'border-primary bg-primary/10 text-foreground',
                status === 'upcoming' && 'border-border bg-card text-muted-foreground',
              )}
            >
              {status === 'done' ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden text-xs sm:inline',
                status === 'current'
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {labels[step]}
            </span>
            {i < VISIBLE_STEPS.length - 1 ? (
              <span aria-hidden className="h-px w-6 bg-border sm:w-10" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
