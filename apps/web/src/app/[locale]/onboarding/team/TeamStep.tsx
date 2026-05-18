'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCcw,
  SkipForward,
  UserPlus,
} from 'lucide-react';

import type { MemberSummary, RoleSummary } from '@tikflow/contracts';
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

import { Link } from '@/i18n/navigation';
import {
  createMemberAction,
  type CreateMemberResult,
} from '@/app/[locale]/(app)/settings/members/new/actions';

import { StepIndicator } from '../StepIndicator';

const NEXT_STEP = '/onboarding/done';

type Props = {
  members: MemberSummary[];
  roles: RoleSummary[];
  locale: string;
};

export function TeamStep({ members, roles, locale }: Props) {
  const t = useTranslations('onboarding.team');
  const ts = useTranslations('onboarding.steps');

  const [state, formAction] = useActionState<CreateMemberResult | null, FormData>(
    async (_p, fd) => createMemberAction(locale, fd),
    null,
  );

  const [password, setPassword] = useState<string>('');

  const generatePassword = () => {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = new Uint32Array(20);
    crypto.getRandomValues(bytes);
    let out = '';
    for (const b of bytes) out += alphabet.charAt(b % alphabet.length);
    setPassword(out);
  };

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="space-y-6">
      <StepIndicator
        current="team"
        labels={{
          general: ts('general'),
          branding: ts('branding'),
          team: ts('team'),
          done: ts('done'),
        }}
      />

      {/* Existing members preview so the admin sees who's already in. */}
      {members.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('existingTitle')}</CardTitle>
            <CardDescription>{t('existingSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                      {m.email.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-sm">{m.email}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.roles.map((r) => (
                      <Badge key={r.id} variant="primary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>

        <form action={formAction} noValidate>
          <CardContent className="space-y-5">
            {state?.ok ? (
              <Alert variant="success">
                <CheckCircle2 aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('saved')}</AlertTitle>
                  <AlertDescription>{t('savedHint')}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}
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

            <FormField label={t('roles')} error={fieldErrors?.roleIds?.[0]} required>
              {({ id }) => (
                <div id={id} role="group" className="grid gap-2 sm:grid-cols-2">
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
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{role.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {role.description ?? ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </FormField>
          </CardContent>

          <CardFooter className="justify-between border-t pt-4">
            <Button asChild variant="ghost" type="button">
              <Link href="/onboarding/branding">
                <ArrowLeft className="size-4" aria-hidden />
                {t('back')}
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" type="button">
                <Link href={NEXT_STEP}>
                  <SkipForward className="size-4" aria-hidden />
                  {t('skip')}
                </Link>
              </Button>
              <AddButton label={t('add')} pendingLabel={t('adding')} />
              <Button asChild type="button">
                <Link href={NEXT_STEP}>
                  {t('continue')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function AddButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
      <UserPlus className="size-4" aria-hidden />
      {pending ? pendingLabel : label}
    </Button>
  );
}
