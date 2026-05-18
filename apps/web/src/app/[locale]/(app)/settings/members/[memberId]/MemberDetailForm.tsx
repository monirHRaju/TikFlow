'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react';

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
} from '@tikflow/ui';

import { Link } from '@/i18n/navigation';
import {
  setMemberStatusAction,
  updateMemberRolesAction,
  type MemberMutationResult,
} from './actions';

type Props = {
  member: MemberSummary;
  roles: RoleSummary[];
  isSelf: boolean;
  locale: string;
  justCreated: boolean;
};

export function MemberDetailForm({ member, roles, isSelf, locale, justCreated }: Props) {
  const t = useTranslations('settings.members.detail');
  const tc = useTranslations('common');

  const memberRoleIds = new Set(member.roles.map((r) => r.id));

  const [rolesState, rolesAction] = useActionState<MemberMutationResult | null, FormData>(
    async (_p, fd) => updateMemberRolesAction(locale, member.id, fd),
    null,
  );

  const [statusState, statusAction] = useActionState<MemberMutationResult | null, FormData>(
    async (_p, fd) => setMemberStatusAction(locale, member.id, fd),
    null,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
          <Link href="/settings/members">
            <ArrowLeft className="size-3.5" aria-hidden />
            {t('back')}
          </Link>
        </Button>
      </div>

      {justCreated ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertContent>
            <AlertTitle>{t('justCreatedTitle')}</AlertTitle>
            <AlertDescription>{t('justCreatedBody', { email: member.email })}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {/* Identity header */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold shadow-sm">
            {member.email.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex-1 space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              {member.email}
              {isSelf ? <Badge variant="muted">{t('you')}</Badge> : null}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <StatusBadge status={member.status} t={t} />
              <span>·</span>
              <span>
                {member.mfaEnabled ? t('mfa.on') : t('mfa.off')}
              </span>
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Roles editor */}
      <Card>
        <CardHeader>
          <CardTitle>{t('rolesTitle')}</CardTitle>
          <CardDescription>{t('rolesSubtitle')}</CardDescription>
        </CardHeader>

        <form action={rolesAction} noValidate>
          <CardContent className="space-y-4">
            {rolesState?.ok ? (
              <Alert variant="success">
                <CheckCircle2 aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('rolesSaved')}</AlertTitle>
                </AlertContent>
              </Alert>
            ) : null}

            {rolesState && !rolesState.ok ? (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('errors.title')}</AlertTitle>
                  <AlertDescription>
                    {mutationCopy(rolesState.code, rolesState.message, t)}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            <FormField label={t('assignedRoles')} description={t('assignedRolesHelp')}>
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
                        defaultChecked={memberRoleIds.has(role.id)}
                        className="mt-0.5 size-4 rounded border-input"
                      />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{role.name}</span>
                          {role.isSystem ? (
                            <Badge variant="muted">{t('systemRole')}</Badge>
                          ) : null}
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
          </CardContent>

          <CardFooter className="justify-end border-t pt-4">
            <SubmitButton label={t('saveRoles')} pendingLabel={tc('saving')} />
          </CardFooter>
        </form>
      </Card>

      {/* Status / danger zone */}
      <Card>
        <CardHeader>
          <CardTitle>{t('statusTitle')}</CardTitle>
          <CardDescription>{t('statusSubtitle')}</CardDescription>
        </CardHeader>

        <form action={statusAction} noValidate>
          <CardContent className="space-y-4">
            {statusState?.ok ? (
              <Alert variant="success">
                <CheckCircle2 aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('statusSaved')}</AlertTitle>
                </AlertContent>
              </Alert>
            ) : null}

            {statusState && !statusState.ok ? (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('errors.title')}</AlertTitle>
                  <AlertDescription>
                    {mutationCopy(statusState.code, statusState.message, t)}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            {isSelf ? (
              <Alert variant="warning">
                <AlertTriangle aria-hidden />
                <AlertContent>
                  <AlertTitle>{t('selfWarning.title')}</AlertTitle>
                  <AlertDescription>{t('selfWarning.body')}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {member.status === 'suspended' ? t('isSuspended') : t('isActive')}
            </p>
          </CardContent>

          <CardFooter className="justify-end border-t pt-4">
            {member.status === 'suspended' ? (
              <>
                <input type="hidden" name="status" value="active" />
                <StatusButton
                  variant="default"
                  icon={<PlayCircle className="size-4" aria-hidden />}
                  label={t('reactivate')}
                  pendingLabel={tc('saving')}
                  disabled={isSelf}
                />
              </>
            ) : (
              <>
                <input type="hidden" name="status" value="suspended" />
                <StatusButton
                  variant="destructive"
                  icon={<PauseCircle className="size-4" aria-hidden />}
                  label={t('suspend')}
                  pendingLabel={tc('saving')}
                  disabled={isSelf}
                />
              </>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: 'active' | 'invited' | 'suspended' | 'deleted';
  t: (k: string) => string;
}) {
  const map = {
    active: { variant: 'success' as const, key: 'status.active' },
    invited: { variant: 'warning' as const, key: 'status.invited' },
    suspended: { variant: 'destructive' as const, key: 'status.suspended' },
    deleted: { variant: 'muted' as const, key: 'status.deleted' },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{t(cfg.key)}</Badge>;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function StatusButton({
  variant,
  icon,
  label,
  pendingLabel,
  disabled,
}: {
  variant: 'default' | 'destructive';
  icon: React.ReactNode;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {icon}
      {pending ? pendingLabel : label}
    </Button>
  );
}

function mutationCopy(
  code: NonNullable<Extract<MemberMutationResult, { ok: false }>['code']>,
  fallback: string | undefined,
  t: (k: string) => string,
): string {
  switch (code) {
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'LAST_OWNER':
      return t('errors.lastOwner');
    case 'SELF_SUSPEND':
      return t('errors.selfSuspend');
    case 'NOT_FOUND':
      return t('errors.notFound');
    case 'UNKNOWN_ROLE':
      return t('errors.unknownRole');
    case 'VALIDATION':
      return fallback ?? t('errors.validation');
    case 'UNEXPECTED':
    default:
      return t('errors.unexpected');
  }
}
