'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';

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
import type { TenantSummary } from '@tikflow/contracts';

import { updateGeneralSettingsAction, type UpdateGeneralResult } from './actions';

type Props = {
  tenant: TenantSummary;
  timezones: ReadonlyArray<string>;
  currencies: ReadonlyArray<{ code: string; label: string }>;
  locale: string;
};

const INITIAL: UpdateGeneralResult | null = null;

export function GeneralSettingsForm({ tenant, timezones, currencies, locale }: Props) {
  const t = useTranslations('settings.general');
  const tc = useTranslations('common');
  const formId = useId();

  const [state, formAction] = useActionState<UpdateGeneralResult | null, FormData>(
    async (_prev, formData) => updateGeneralSettingsAction(locale, formData),
    INITIAL,
  );

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cardTitle')}</CardTitle>
        <CardDescription>{t('cardSubtitle')}</CardDescription>
      </CardHeader>

      <form id={formId} action={formAction} noValidate>
        <CardContent className="space-y-6">
          {state?.ok ? (
            <Alert variant="success">
              <CheckCircle2 aria-hidden />
              <AlertContent>
                <AlertTitle>{t('saved')}</AlertTitle>
                <AlertDescription>{t('savedDesc')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {state && !state.ok && state.code === 'FORBIDDEN' ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertContent>
                <AlertTitle>{t('errors.forbiddenTitle')}</AlertTitle>
                <AlertDescription>{t('errors.forbidden')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {state && !state.ok && state.code === 'UNEXPECTED' ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertContent>
                <AlertTitle>{t('errors.unexpectedTitle')}</AlertTitle>
                <AlertDescription>{t('errors.unexpected')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <ReadonlySlugField slug={tenant.slug} label={t('slug')} description={t('slugHelp')} />

          <FormField
            label={t('name')}
            description={t('nameHelp')}
            error={fieldErrors?.name?.[0]}
            required
          >
            {({ id, descriptionId, errorId }) => (
              <Input
                id={id}
                name="name"
                type="text"
                required
                maxLength={120}
                defaultValue={tenant.name}
                aria-describedby={errorId ?? descriptionId}
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
                inputMode="email"
                defaultValue={tenant.billingEmail ?? ''}
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.billingEmail)}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('timezone')}
              description={t('timezoneHelp')}
              error={fieldErrors?.timezone?.[0]}
              required
            >
              {({ id, descriptionId, errorId }) => (
                <Select
                  id={id}
                  name="timezone"
                  required
                  defaultValue={tenant.timezone}
                  aria-describedby={errorId ?? descriptionId}
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

            <FormField
              label={t('currency')}
              description={t('currencyHelp')}
              error={fieldErrors?.currency?.[0]}
              required
            >
              {({ id, descriptionId, errorId }) => (
                <Select
                  id={id}
                  name="currency"
                  required
                  defaultValue={tenant.currency}
                  aria-describedby={errorId ?? descriptionId}
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

        <CardFooter className="justify-end gap-2 border-t pt-4">
          <SubmitButton label={t('save')} pendingLabel={tc('saving')} />
        </CardFooter>
      </form>
    </Card>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function ReadonlySlugField({
  slug,
  label,
  description,
}: {
  slug: string;
  label: string;
  description: string;
}) {
  return (
    <FormField label={label} description={description}>
      {({ id, descriptionId }) => (
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
          <Building2 aria-hidden className="size-4 text-muted-foreground" />
          <span id={id} aria-describedby={descriptionId} className="font-mono">
            {slug}
          </span>
        </div>
      )}
    </FormField>
  );
}
