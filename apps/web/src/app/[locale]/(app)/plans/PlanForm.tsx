'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, Archive, CheckCircle2 } from 'lucide-react';

import type { ServicePlanDetail } from '@tikflow/contracts';
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
  archivePlanAction,
  createPlanAction,
  updatePlanAction,
  type PlanMutationResult,
} from './actions';

type Props = {
  mode: 'create' | 'edit';
  plan: ServicePlanDetail | null;
  locale: string;
};

export function PlanForm({ mode, plan, locale }: Props) {
  const t = useTranslations('plans.form');
  const tc = useTranslations('common');
  const router = useRouter();
  const [archiving, startArchive] = useTransition();

  const [state, formAction] = useActionState<PlanMutationResult | null, FormData>(
    async (prev, fd) =>
      mode === 'create'
        ? createPlanAction(locale, prev, fd)
        : updatePlanAction(locale, plan!.id, prev, fd),
    null,
  );

  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const archive = () => {
    if (!plan) return;
    if (!confirm(t('archiveConfirm', { name: plan.name }))) return;
    startArchive(async () => {
      const res = await archivePlanAction(locale, plan.id);
      if (res.ok) router.push('/plans');
      else alert(copy(res, t));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/plans">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('name')} error={fe?.name?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={plan?.name ?? ''}
                  aria-invalid={Boolean(fe?.name)}
                />
              )}
            </FormField>
            <FormField label={t('code')} description={t('codeHelp')} error={fe?.code?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="code"
                  required
                  maxLength={40}
                  className="font-mono uppercase"
                  defaultValue={plan?.code ?? ''}
                  aria-invalid={Boolean(fe?.code)}
                />
              )}
            </FormField>
          </div>

          <FormField label={t('description')} error={fe?.description?.[0]}>
            {({ id }) => (
              <Textarea
                id={id}
                name="description"
                rows={2}
                maxLength={500}
                defaultValue={plan?.description ?? ''}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('type')} error={fe?.type?.[0]} required>
              {({ id }) => (
                <Select id={id} name="type" defaultValue={plan?.type ?? 'pppoe'}>
                  <option value="pppoe">PPPoE</option>
                  <option value="hotspot">Hotspot</option>
                  <option value="static">Static IP</option>
                  <option value="wireless">Wireless</option>
                </Select>
              )}
            </FormField>
            <FormField label={t('validityDays')} error={fe?.validityDays?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="validityDays"
                  type="number"
                  min="1"
                  max="3650"
                  required
                  defaultValue={plan?.validityDays ?? 30}
                />
              )}
            </FormField>
            <FormField label={t('status')}>
              {() => (
                <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={plan?.isActive ?? true}
                    className="size-4 rounded border-input"
                  />
                  {t('isActive')}
                </label>
              )}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('uploadKbps')} description={t('speedHelp')} error={fe?.uploadKbps?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="uploadKbps"
                  type="number"
                  min="1"
                  required
                  defaultValue={plan?.uploadKbps ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('downloadKbps')} description={t('speedHelp')} error={fe?.downloadKbps?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="downloadKbps"
                  type="number"
                  min="1"
                  required
                  defaultValue={plan?.downloadKbps ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('burstUploadKbps')} error={fe?.burstUploadKbps?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="burstUploadKbps"
                  type="number"
                  min="1"
                  defaultValue={plan?.burstUploadKbps ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('burstDownloadKbps')} error={fe?.burstDownloadKbps?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="burstDownloadKbps"
                  type="number"
                  min="1"
                  defaultValue={plan?.burstDownloadKbps ?? ''}
                />
              )}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('price')} description={t('priceHelp')} error={fe?.price?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={plan?.price ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('vatPct')} error={fe?.vatPct?.[0]} required>
              {({ id }) => (
                <Input
                  id={id}
                  name="vatPct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  defaultValue={plan?.vatPct ?? 0}
                />
              )}
            </FormField>
          </div>

          <details className="rounded-md border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">{t('advanced')}</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField label={t('fupLimitGb')} error={fe?.fupLimitGb?.[0]}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="fupLimitGb"
                    type="number"
                    min="1"
                    defaultValue={plan?.fupLimitGb ?? ''}
                  />
                )}
              </FormField>
              <FormField label={t('fupThrottleKbps')} error={fe?.fupThrottleKbps?.[0]}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="fupThrottleKbps"
                    type="number"
                    min="1"
                    defaultValue={plan?.fupThrottleKbps ?? ''}
                  />
                )}
              </FormField>
              <FormField
                label={t('mikrotikProfile')}
                description={t('mikrotikProfileHelp')}
                error={fe?.mikrotikProfile?.[0]}
              >
                {({ id }) => (
                  <Input
                    id={id}
                    name="mikrotikProfile"
                    type="text"
                    maxLength={120}
                    className="font-mono"
                    defaultValue={plan?.mikrotikProfile ?? ''}
                  />
                )}
              </FormField>
            </div>
          </details>
        </CardContent>

        <CardFooter className="justify-between border-t pt-4">
          <div>
            {mode === 'edit' && plan ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={archive}
                disabled={archiving || plan.subscriberCount > 0}
              >
                <Archive className="size-4" aria-hidden />
                {archiving ? tc('saving') : t('archive')}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/plans">{tc('cancel')}</Link>
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
  state: Extract<PlanMutationResult, { ok: false }>,
  t: (k: string) => string,
): string {
  switch (state.code) {
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'CODE_TAKEN':
      return t('errors.codeTaken');
    case 'NOT_FOUND':
      return t('errors.notFound');
    case 'IN_USE':
      return t('errors.inUse');
    case 'VALIDATION':
      return state.message ?? t('errors.validation');
    default:
      return t('errors.unexpected');
  }
}
