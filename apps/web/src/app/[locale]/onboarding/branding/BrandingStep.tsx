'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';

import type { TenantBranding } from '@tikflow/contracts';
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
  cn,
} from '@tikflow/ui';

import { Link, useRouter } from '@/i18n/navigation';
import {
  updateBrandingAction,
  type UpdateBrandingResult,
} from '@/app/[locale]/(app)/settings/branding/actions';

import { StepIndicator } from '../StepIndicator';

const DEFAULT_ACCENT = '#2563eb';
const NEXT_STEP = '/onboarding/team';

type Props = {
  branding: TenantBranding;
  locale: string;
};

export function BrandingStep({ branding, locale }: Props) {
  const t = useTranslations('onboarding.branding');
  const ts = useTranslations('onboarding.steps');
  const router = useRouter();

  const [state, formAction] = useActionState<UpdateBrandingResult | null, FormData>(
    async (_p, fd) => updateBrandingAction(locale, fd),
    null,
  );

  const [accent, setAccent] = useState<string>(branding.accentHex ?? DEFAULT_ACCENT);
  const [accentEnabled, setAccentEnabled] = useState<boolean>(branding.accentHex !== null);

  useEffect(() => {
    if (state?.ok) router.push(NEXT_STEP);
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="space-y-6">
      <StepIndicator
        current="branding"
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

            <FormField
              label={t('accentColor')}
              description={t('accentColorHelp')}
              error={fieldErrors?.accentHex?.[0]}
            >
              {({ id }) => (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={accentEnabled}
                      onChange={(e) => setAccentEnabled(e.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    {t('accentEnabled')}
                  </label>
                  <input
                    type="color"
                    id={id}
                    name="accentHex"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    disabled={!accentEnabled}
                    className={cn(
                      'h-9 w-16 cursor-pointer rounded-md border border-input bg-transparent p-1 shadow-sm',
                      !accentEnabled && 'opacity-50 cursor-not-allowed',
                    )}
                  />
                  <code className="text-sm font-mono text-muted-foreground">
                    {accentEnabled ? accent : t('accentUnset')}
                  </code>
                  {!accentEnabled ? <input type="hidden" name="accentHex" value="" /> : null}
                </div>
              )}
            </FormField>

            <FormField
              label={t('logoUrl')}
              description={t('logoUrlHelp')}
              error={fieldErrors?.logoUrl?.[0]}
            >
              {({ id, descriptionId, errorId }) => (
                <Input
                  id={id}
                  name="logoUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://cdn.example.com/logo.svg"
                  defaultValue={branding.logoUrl ?? ''}
                  aria-describedby={errorId ?? descriptionId}
                  aria-invalid={Boolean(fieldErrors?.logoUrl)}
                />
              )}
            </FormField>

            {/* Carry the invoice fields forward unchanged so the action's
                schema validation accepts the partial wizard submission. */}
            <input type="hidden" name="invoicePrefix" value={branding.invoicePrefix ?? ''} />
            <input type="hidden" name="invoiceHeader" value={branding.invoiceHeader ?? ''} />
            <input type="hidden" name="invoiceFooter" value={branding.invoiceFooter ?? ''} />

            <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              {t('invoiceNote')}
            </p>
          </CardContent>

          <CardFooter className="justify-between border-t pt-4">
            <Button asChild variant="ghost" type="button">
              <Link href="/onboarding/general">
                <ArrowLeft className="size-4" aria-hidden />
                {t('back')}
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button asChild variant="outline" type="button">
                <Link href={NEXT_STEP}>
                  <SkipForward className="size-4" aria-hidden />
                  {t('skip')}
                </Link>
              </Button>
              <ContinueButton label={t('continue')} pendingLabel={t('saving')} />
            </div>
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
