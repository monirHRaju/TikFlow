'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';

import type {
  ServicePlanSummary,
  SubscriberDetail,
  ZoneSummary,
} from '@tikflow/contracts';
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
  Textarea,
} from '@tikflow/ui';

import { Link, useRouter } from '@/i18n/navigation';
import {
  createSubscriberAction,
  deleteSubscriberAction,
  updateSubscriberAction,
  type SubscriberMutationResult,
} from './actions';

type Props = {
  mode: 'create' | 'edit';
  subscriber: SubscriberDetail | null;
  zones: ZoneSummary[];
  plans: ServicePlanSummary[];
  locale: string;
};

export function SubscriberForm({ mode, subscriber, zones, plans, locale }: Props) {
  const t = useTranslations('subscribers.form');
  const tc = useTranslations('common');
  const router = useRouter();
  const [deleting, startDelete] = useTransition();

  const [state, formAction] = useActionState<SubscriberMutationResult | null, FormData>(
    async (prev, fd) =>
      mode === 'create'
        ? createSubscriberAction(locale, prev, fd)
        : updateSubscriberAction(locale, subscriber!.id, prev, fd),
    null,
  );

  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const remove = () => {
    if (!subscriber) return;
    if (!confirm(t('deleteConfirm', { name: subscriber.fullName }))) return;
    startDelete(async () => {
      const res = await deleteSubscriberAction(locale, subscriber.id);
      if (res.ok) router.push('/subscribers');
      else alert(copy(res, t));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/subscribers">
              <ArrowLeft className="size-3.5" aria-hidden />
              {t('back')}
            </Link>
          </Button>
        </div>
        <CardTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>

      <form action={formAction} noValidate>
        <CardContent className="space-y-5">
          {state?.ok && mode === 'edit' ? (
            <Alert variant="success">
              <CheckCircle2 aria-hidden />
              <AlertContent>
                <AlertTitle>{t('saved')}</AlertTitle>
              </AlertContent>
            </Alert>
          ) : null}
          {state && !state.ok && state.code !== 'VALIDATION' ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertContent>
                <AlertTitle>{t('errors.title')}</AlertTitle>
                <AlertDescription>{copy(state, t)}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('section.identity')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('code')} description={t('codeHelp')} error={fe?.code?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="code"
                  required
                  maxLength={40}
                  className="font-mono uppercase"
                  defaultValue={subscriber?.code ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('fullName')} error={fe?.fullName?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="fullName"
                  required
                  maxLength={120}
                  defaultValue={subscriber?.fullName ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('fatherName')} error={fe?.fatherName?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="fatherName"
                  maxLength={120}
                  defaultValue={subscriber?.fatherName ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('nidNumber')} description={t('nidHelp')} error={fe?.nidNumber?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="nidNumber"
                  maxLength={40}
                  className="font-mono"
                  defaultValue={subscriber?.nidNumber ?? ''}
                />
              )}
            </FormField>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('section.contact')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('phone')} error={fe?.phone?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  defaultValue={subscriber?.phone ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('altPhone')} error={fe?.altPhone?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="altPhone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={subscriber?.altPhone ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('email')} error={fe?.email?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="email"
                  type="email"
                  defaultValue={subscriber?.email ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('installationDate')} error={fe?.installationDate?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="installationDate"
                  type="date"
                  defaultValue={subscriber?.installationDate ?? ''}
                />
              )}
            </FormField>
          </div>
          <FormField label={t('address')} error={fe?.address?.[0]}>
            {({ id }) => (
              <Textarea
                id={id}
                name="address"
                rows={2}
                maxLength={500}
                defaultValue={subscriber?.address ?? ''}
              />
            )}
          </FormField>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('section.service')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('zone')} error={fe?.zoneId?.[0]}>
              {({ id }) => (
                <Select id={id} name="zoneId" defaultValue={subscriber?.zone?.id ?? ''}>
                  <option value="">{t('noZone')}</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label={t('connectionType')} error={fe?.connectionType?.[0]} required>
              {({ id }) => (
                <Select
                  id={id}
                  name="connectionType"
                  defaultValue={subscriber?.connectionType ?? 'pppoe'}
                >
                  <option value="pppoe">PPPoE</option>
                  <option value="hotspot">Hotspot</option>
                  <option value="static">Static IP</option>
                </Select>
              )}
            </FormField>
            <FormField label={t('plan')} description={t('planHelp')} error={fe?.planId?.[0]}>
              {({ id }) => (
                <Select id={id} name="planId" defaultValue={subscriber?.currentPlan?.id ?? ''}>
                  <option value="">{t('noPlan')}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price.toLocaleString(locale)})
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {mode === 'edit' ? (
              <FormField label={t('status')} error={fe?.status?.[0]} required>
                {({ id }) => (
                  <Select id={id} name="status" defaultValue={subscriber?.status ?? 'pending'}>
                    <option value="pending">{t('statusOpts.pending')}</option>
                    <option value="active">{t('statusOpts.active')}</option>
                    <option value="suspended">{t('statusOpts.suspended')}</option>
                    <option value="cancelled">{t('statusOpts.cancelled')}</option>
                  </Select>
                )}
              </FormField>
            ) : null}
          </div>

          <FormField label={t('notes')} error={fe?.notes?.[0]}>
            {({ id }) => (
              <Textarea
                id={id}
                name="notes"
                rows={3}
                maxLength={1000}
                defaultValue={subscriber?.notes ?? ''}
              />
            )}
          </FormField>
        </CardContent>

        <CardFooter className="justify-between border-t pt-4">
          <div>
            {mode === 'edit' && subscriber ? (
              <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={deleting}>
                <Trash2 className="size-4" aria-hidden />
                {deleting ? tc('saving') : t('delete')}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/subscribers">{tc('cancel')}</Link>
            </Button>
            <SaveButton label={mode === 'create' ? t('create') : t('save')} pendingLabel={tc('saving')} />
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function copy(
  state: Extract<SubscriberMutationResult, { ok: false }>,
  t: (k: string) => string,
): string {
  switch (state.code) {
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'CODE_TAKEN':
      return t('errors.codeTaken');
    case 'NOT_FOUND':
      return t('errors.notFound');
    case 'UNKNOWN_ZONE':
      return t('errors.unknownZone');
    case 'UNKNOWN_PLAN':
      return t('errors.unknownPlan');
    case 'VALIDATION':
      return state.message ?? t('errors.validation');
    default:
      return t('errors.unexpected');
  }
}
