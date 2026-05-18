'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react';

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
  Textarea,
  cn,
} from '@tikflow/ui';
import type { TenantBranding } from '@tikflow/contracts';

import { updateBrandingAction, type UpdateBrandingResult } from './actions';

type Props = {
  branding: TenantBranding;
  locale: string;
};

const DEFAULT_ACCENT = '#2563eb';

export function BrandingForm({ branding, locale }: Props) {
  const t = useTranslations('settings.branding');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<UpdateBrandingResult | null, FormData>(
    async (_prev, formData) => updateBrandingAction(locale, formData),
    null,
  );

  // Live preview state so the user sees the accent applied immediately
  // without waiting for the round-trip. Persisted state still wins after
  // save (the layout reads from the DB).
  const [accent, setAccent] = useState<string>(branding.accentHex ?? DEFAULT_ACCENT);
  const [accentEnabled, setAccentEnabled] = useState<boolean>(branding.accentHex !== null);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cardTitle')}</CardTitle>
        <CardDescription>{t('cardSubtitle')}</CardDescription>
      </CardHeader>

      <form action={formAction} noValidate>
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

          <FormField
            label={t('accentColor')}
            description={t('accentColorHelp')}
            error={fieldErrors?.accentHex?.[0]}
          >
            {({ id, descriptionId, errorId }) => (
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="accentEnabled"
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
                  aria-describedby={errorId ?? descriptionId}
                  aria-invalid={Boolean(fieldErrors?.accentHex)}
                  className={cn(
                    'h-9 w-16 cursor-pointer rounded-md border border-input bg-transparent p-1 shadow-sm transition-opacity',
                    !accentEnabled && 'opacity-50 cursor-not-allowed',
                  )}
                />
                <code className="text-sm font-mono text-muted-foreground">
                  {accentEnabled ? accent : t('accentUnset')}
                </code>
                <PreviewSwatch hex={accentEnabled ? accent : null} label={t('preview')} />
                {/* When unchecked, submit an empty value so the server clears the saved accent. */}
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
              <div className="space-y-2">
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
                {branding.logoUrl ? (
                  <LogoPreview url={branding.logoUrl} label={t('logoCurrentLabel')} />
                ) : null}
              </div>
            )}
          </FormField>

          <FormField
            label={t('invoicePrefix')}
            description={t('invoicePrefixHelp')}
            error={fieldErrors?.invoicePrefix?.[0]}
          >
            {({ id, descriptionId, errorId }) => (
              <Input
                id={id}
                name="invoicePrefix"
                type="text"
                maxLength={10}
                placeholder="INV-"
                defaultValue={branding.invoicePrefix ?? ''}
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.invoicePrefix)}
                className="font-mono uppercase"
              />
            )}
          </FormField>

          <FormField
            label={t('invoiceHeader')}
            description={t('invoiceHeaderHelp')}
            error={fieldErrors?.invoiceHeader?.[0]}
          >
            {({ id, descriptionId, errorId }) => (
              <Textarea
                id={id}
                name="invoiceHeader"
                rows={4}
                maxLength={1000}
                defaultValue={branding.invoiceHeader ?? ''}
                placeholder={t('invoiceHeaderPlaceholder')}
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.invoiceHeader)}
              />
            )}
          </FormField>

          <FormField
            label={t('invoiceFooter')}
            description={t('invoiceFooterHelp')}
            error={fieldErrors?.invoiceFooter?.[0]}
          >
            {({ id, descriptionId, errorId }) => (
              <Textarea
                id={id}
                name="invoiceFooter"
                rows={3}
                maxLength={1000}
                defaultValue={branding.invoiceFooter ?? ''}
                placeholder={t('invoiceFooterPlaceholder')}
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.invoiceFooter)}
              />
            )}
          </FormField>
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

function PreviewSwatch({ hex, label }: { hex: string | null; label: string }) {
  if (!hex) return null;
  return (
    <span
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2 py-1 text-xs"
    >
      <span
        aria-hidden
        className="inline-block size-4 rounded ring-1 ring-border"
        style={{ backgroundColor: hex }}
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function LogoPreview({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-input bg-muted/30 p-3">
      <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      {/* Tenant-supplied URLs are not trusted; we render with referrerpolicy=no-referrer
          and a strict CSP via Next headers. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className="h-8 w-auto rounded bg-card"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
