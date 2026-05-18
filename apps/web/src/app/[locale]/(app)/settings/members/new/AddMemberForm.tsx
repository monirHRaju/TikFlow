'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, KeyRound, RefreshCcw } from 'lucide-react';

import type { RoleSummary } from '@tikflow/contracts';
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
import { createMemberAction, type CreateMemberResult } from './actions';

type Props = {
  roles: RoleSummary[];
  locale: string;
};

export function AddMemberForm({ roles, locale }: Props) {
  const t = useTranslations('settings.members.add');
  const tc = useTranslations('common');
  const router = useRouter();

  const [state, formAction] = useActionState<CreateMemberResult | null, FormData>(
    async (_prev, formData) => createMemberAction(locale, formData),
    null,
  );

  // Forward to the new member's detail page on success. We do this in
  // the client instead of `redirect()` inside the action so other
  // callers (the onboarding Team step) can reuse the action without
  // being bounced out of their own flow.
  useEffect(() => {
    if (state?.ok) {
      router.push(`/settings/members/${state.memberId}?welcome=1`);
    }
  }, [state, router]);

  const [password, setPassword] = useState<string>('');

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  const generatePassword = () => {
    // 20 chars, mixed case + digits + symbols, generated in-browser so
    // it never round-trips through a network or server log.
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = new Uint32Array(20);
    crypto.getRandomValues(bytes);
    let out = '';
    for (const b of bytes) {
      const idx = b % alphabet.length;
      out += alphabet.charAt(idx);
    }
    setPassword(out);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/settings/members">
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
            label={t('email')}
            description={t('emailHelp')}
            error={fieldErrors?.email?.[0]}
            required
          >
            {({ id, descriptionId, errorId }) => (
              <Input
                id={id}
                name="email"
                type="email"
                autoComplete="off"
                required
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.email)}
              />
            )}
          </FormField>

          <FormField
            label={t('password')}
            description={t('passwordHelp')}
            error={fieldErrors?.password?.[0]}
            required
          >
            {({ id, descriptionId, errorId }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  name="password"
                  type="text"
                  autoComplete="off"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                  aria-describedby={errorId ?? descriptionId}
                  aria-invalid={Boolean(fieldErrors?.password)}
                />
                <Button type="button" variant="outline" onClick={generatePassword}>
                  <RefreshCcw className="size-4" aria-hidden />
                  {t('generate')}
                </Button>
              </div>
            )}
          </FormField>

          <FormField
            label={t('roles')}
            description={t('rolesHelp')}
            error={fieldErrors?.roleIds?.[0]}
            required
          >
            {({ id, descriptionId, errorId }) => (
              <div
                id={id}
                role="group"
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.roleIds)}
                className="grid gap-2 sm:grid-cols-2"
              >
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 transition-colors hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      name="roleIds"
                      value={role.id}
                      className="mt-0.5 size-4 rounded border-input"
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{role.name}</span>
                        {role.isSystem ? <Badge variant="muted">{t('systemRole')}</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {role.description ?? t('noDescription')}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </FormField>

          <Alert variant="info">
            <KeyRound aria-hidden />
            <AlertContent>
              <AlertTitle>{t('shareNote.title')}</AlertTitle>
              <AlertDescription>{t('shareNote.body')}</AlertDescription>
            </AlertContent>
          </Alert>
        </CardContent>

        <CardFooter className="justify-end gap-2 border-t pt-4">
          <Button asChild type="button" variant="outline">
            <Link href="/settings/members">{tc('cancel')}</Link>
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
