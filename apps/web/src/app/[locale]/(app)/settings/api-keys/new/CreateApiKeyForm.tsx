'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

import type { ApiKeyScope, CreatedApiKey } from '@tikflow/contracts';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from '@tikflow/ui';

import { Link, useRouter } from '@/i18n/navigation';
import { createApiKeyAction, type CreateApiKeyResult } from './actions';

type Props = {
  scopes: ApiKeyScope[];
  locale: string;
};

export function CreateApiKeyForm({ scopes, locale }: Props) {
  const t = useTranslations('settings.apiKeys.new');
  const tc = useTranslations('common');
  const router = useRouter();

  const [state, formAction] = useActionState<CreateApiKeyResult | null, FormData>(
    async (_p, fd) => createApiKeyAction(locale, fd),
    null,
  );

  // Show the show-once panel after success.
  if (state?.ok) {
    return <ShowOncePanel created={state.created} onDone={() => router.push('/settings/api-keys')} />;
  }

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  // Sensible default expiry: 90 days out.
  const defaultExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/settings/api-keys">
              <ArrowLeft className="size-3.5" aria-hidden />
              {t('back')}
            </Link>
          </Button>
        </div>
        <CardTitle>{t('cardTitle')}</CardTitle>
        <CardDescription>{t('cardSubtitle')}</CardDescription>
      </CardHeader>

      <form action={formAction} noValidate>
        <CardContent className="space-y-6">
          {state && !state.ok && state.code === 'FORBIDDEN' ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertContent>
                <AlertTitle>{t('errors.forbiddenTitle')}</AlertTitle>
                <AlertDescription>{t('errors.forbidden')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {state && !state.ok && (state.code === 'HASH_COLLISION' || state.code === 'UNEXPECTED') ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertContent>
                <AlertTitle>{t('errors.unexpectedTitle')}</AlertTitle>
                <AlertDescription>{t('errors.unexpected')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormField
            label={t('label')}
            description={t('labelHelp')}
            error={fieldErrors?.label?.[0]}
            required
          >
            {({ id, descriptionId, errorId }) => (
              <Input
                id={id}
                name="label"
                type="text"
                required
                maxLength={80}
                placeholder="e.g. Production webhooks"
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.label)}
              />
            )}
          </FormField>

          <FormField
            label={t('scopes')}
            description={t('scopesHelp')}
            error={fieldErrors?.scopes?.[0]}
            required
          >
            {({ id }) => (
              <div id={id} role="group" className="grid gap-2 sm:grid-cols-2">
                {scopes.map((scope) => (
                  <label
                    key={scope}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      name="scopes"
                      value={scope}
                      className="size-4 rounded border-input"
                    />
                    <code className="text-sm font-mono">{scope}</code>
                  </label>
                ))}
              </div>
            )}
          </FormField>

          <FormField
            label={t('expiresAt')}
            description={t('expiresAtHelp')}
            error={fieldErrors?.expiresAt?.[0]}
          >
            {({ id, descriptionId, errorId }) => (
              <Input
                id={id}
                name="expiresAt"
                type="date"
                defaultValue={defaultExpiry}
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.expiresAt)}
              />
            )}
          </FormField>

          <Alert variant="warning">
            <ShieldAlert aria-hidden />
            <AlertContent>
              <AlertTitle>{t('warning.title')}</AlertTitle>
              <AlertDescription>{t('warning.body')}</AlertDescription>
            </AlertContent>
          </Alert>
        </CardContent>

        <CardFooter className="justify-end gap-2 border-t pt-4">
          <Button asChild type="button" variant="outline">
            <Link href="/settings/api-keys">{tc('cancel')}</Link>
          </Button>
          <SubmitButton label={t('submit')} pendingLabel={t('submitting')} />
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

function ShowOncePanel({
  created,
  onDone,
}: {
  created: CreatedApiKey;
  onDone: () => void;
}) {
  const t = useTranslations('settings.apiKeys.new.created');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.plaintext);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (insecure context, denied permission, etc.).
      // The user can still select-and-copy the visible text.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" aria-hidden />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle', { label: created.label })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert variant="warning">
          <ShieldAlert aria-hidden />
          <AlertContent>
            <AlertTitle>{t('once.title')}</AlertTitle>
            <AlertDescription>{t('once.body')}</AlertDescription>
          </AlertContent>
        </Alert>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('keyLabel')}
          </p>
          <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 p-3">
            <code className="flex-1 break-all font-mono text-sm select-all">
              {created.plaintext}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <>
                  <Check className="size-4" aria-hidden />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden />
                  {t('copy')}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('prefix')}
            </p>
            <code className="font-mono">{created.prefix}…</code>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('expiresAt')}
            </p>
            <span className="text-muted-foreground">
              {created.expiresAt
                ? new Date(created.expiresAt).toLocaleDateString()
                : t('never')}
            </span>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('scopes')}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {created.scopes.map((s) => (
                <Badge key={s} variant="muted" className="font-mono text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="size-4 rounded border-input"
          />
          {t('confirm')}
        </label>
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button onClick={onDone} disabled={!confirmed}>
          {t('done')}
        </Button>
      </CardFooter>
    </Card>
  );
}
