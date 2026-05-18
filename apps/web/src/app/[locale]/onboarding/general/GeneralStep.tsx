'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';

import type { TenantSummary } from '@tikflow/contracts';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
} from '@tikflow/ui';

import { Link, useRouter } from '@/i18n/navigation';
import {
  updateGeneralSettingsAction,
  type UpdateGeneralResult,
} from '@/app/[locale]/(app)/settings/general/actions';

import { StepIndicator } from '../StepIndicator';

type Props = {
  tenant: TenantSummary;
  timezones: ReadonlyArray<string>;
  currencies: ReadonlyArray<{ code: string; label: string }>;
  locale: string;
};

export function GeneralStep({ tenant, timezones, currencies, locale }: Props) {
  const t = useTranslations('onboarding.general');
  const ts = useTranslations('onboarding.steps');
  const router = useRouter();

  const [state, formAction] = useActionState<UpdateGeneralResult | null, FormData>(
    async (_prev, fd) => updateGeneralSettingsAction(locale, fd),
    null,
  );

  // On success, advance to the next step.
  useEffect(() => {
    if (state?.ok) router.push('/onboarding/branding');
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="space-y-6">
      <StepIndicator
        current="general"
        labels={{
          general: ts('general'),
          branding: ts('branding'),
          team: ts('team'),
          done: ts('done'),
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>

        <form action={formAction} noValidate>
          <CardContent className="space-y-5">
            {state && !state.ok && state.code === 'UNEXPECTED' ? (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('errorTitle')}</AlertTitle>
                  <AlertDescription>{t('errorBody')}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            <FormField label={t('name')} error={fieldErrors?.name?.[0]} required>
              {({ id, errorId }) => (
                <Input
                  id={id}
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  defaultValue={tenant.name}
                  aria-describedby={errorId}
                  aria-invalid={Boolean(fieldErrors?.name)}
                />
              )}
            </FormField>

            <FormField
              label={t('billingEmail')}
              description={t('billingEmailHelp')}
              error={fieldErrors?.billingEmail?.[0]}
            >
              {({ id, descriptionId, errorId }) => (
                <Input
                  id={id}
                  name="billingEmail"
                  type="email"
                  autoComplete="email"
                  defaultValue={tenant.billingEmail ?? ''}
                  aria-describedby={errorId ?? descriptionId}
                  aria-invalid={Boolean(fieldErrors?.billingEmail)}
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('timezone')} error={fieldErrors?.timezone?.[0]} required>
                {({ id, errorId }) => (
                  <Select
                    id={id}
                    name="timezone"
                    required
                    defaultValue={tenant.timezone}
                    aria-describedby={errorId}
                    aria-invalid={Boolean(fieldErrors?.timezone)}
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <FormField label={t('currency')} error={fieldErrors?.currency?.[0]} required>
                {({ id, errorId }) => (
                  <Select
                    id={id}
                    name="currency"
                    required
                    defaultValue={tenant.currency}
                    aria-describedby={errorId}
                    aria-invalid={Boolean(fieldErrors?.currency)}
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          </CardContent>

          <CardFooter className="justify-between border-t pt-4">
            <Button asChild variant="ghost" type="button">
              <Link href="/onboarding/welcome">
                <ArrowLeft className="size-4" aria-hidden />
                {t('back')}
              </Link>
            </Button>
            <ContinueButton label={t('continue')} pendingLabel={t('saving')} />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function ContinueButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
      <ArrowRight className="size-4" aria-hidden />
    </Button>
  );
}
