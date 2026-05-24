'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';

import type { InventoryItemSummary, SubscriberSummary } from '@tikflow/contracts';
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
  createInventoryAction,
  deleteInventoryAction,
  updateInventoryAction,
  type InventoryMutationResult,
} from './actions';

const TYPES = ['ont', 'onu', 'router', 'switch', 'splitter', 'cable_drum', 'nic', 'antenna', 'other'] as const;
const STATUSES = ['in_stock', 'allocated', 'deployed', 'faulty', 'returned', 'scrapped'] as const;

type Props = {
  mode: 'create' | 'edit';
  item: InventoryItemSummary | null;
  subscribers: SubscriberSummary[];
  locale: string;
};

export function InventoryForm({ mode, item, subscribers, locale }: Props) {
  const t = useTranslations('inventory.form');
  const tList = useTranslations('inventory');
  const tc = useTranslations('common');
  const router = useRouter();
  const [deleting, startDelete] = useTransition();

  const [state, formAction] = useActionState<InventoryMutationResult | null, FormData>(
    async (prev, fd) =>
      mode === 'create'
        ? createInventoryAction(locale, prev, fd)
        : updateInventoryAction(locale, item!.id, prev, fd),
    null,
  );

  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const remove = () => {
    if (!item) return;
    if (!confirm(t('deleteConfirm', { serial: item.serial ?? item.id }))) return;
    startDelete(async () => {
      const res = await deleteInventoryAction(locale, item.id);
      if (res.ok) router.push('/inventory');
      else alert(copy(res, t));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/inventory">
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
            <FormField label={t('type')} error={fe?.type?.[0]} required>
              {({ id }) => (
                <Select id={id} name="type" defaultValue={item?.type ?? 'other'}>
                  {TYPES.map((tt) => (
                    <option key={tt} value={tt}>
                      {tList(`type.${tt}`)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label={t('status')} error={fe?.status?.[0]} required>
              {({ id }) => (
                <Select id={id} name="status" defaultValue={item?.status ?? 'in_stock'}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {tList(`status.${s}`)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label={t('serial')} error={fe?.serial?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="serial"
                  maxLength={80}
                  className="font-mono"
                  defaultValue={item?.serial ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('mac')} description={t('macHelp')} error={fe?.mac?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="mac"
                  className="font-mono"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  defaultValue={item?.mac ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('vendor')} error={fe?.vendor?.[0]}>
              {({ id }) => (
                <Input id={id} name="vendor" maxLength={80} defaultValue={item?.vendor ?? ''} />
              )}
            </FormField>
            <FormField label={t('model')} error={fe?.model?.[0]}>
              {({ id }) => (
                <Input id={id} name="model" maxLength={120} defaultValue={item?.model ?? ''} />
              )}
            </FormField>
            <FormField label={t('location')} error={fe?.location?.[0]}>
              {({ id }) => (
                <Input id={id} name="location" maxLength={200} defaultValue={item?.location ?? ''} />
              )}
            </FormField>
            <FormField
              label={t('subscriber')}
              description={t('subscriberHelp')}
              error={fe?.subscriberId?.[0]}
            >
              {({ id }) => (
                <Select id={id} name="subscriberId" defaultValue={item?.subscriber?.id ?? ''}>
                  <option value="">{t('noSubscriber')}</option>
                  {subscribers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.fullName}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label={t('purchasedAt')} error={fe?.purchasedAt?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="purchasedAt"
                  type="date"
                  defaultValue={item?.purchasedAt ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('warrantyUntil')} error={fe?.warrantyUntil?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="warrantyUntil"
                  type="date"
                  defaultValue={item?.warrantyUntil ?? ''}
                />
              )}
            </FormField>
            <FormField label={t('cost')} error={fe?.cost?.[0]}>
              {({ id }) => (
                <Input
                  id={id}
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item?.cost ?? ''}
                />
              )}
            </FormField>
          </div>

          <FormField label={t('notes')} error={fe?.notes?.[0]}>
            {({ id }) => (
              <Textarea id={id} name="notes" rows={3} maxLength={1000} defaultValue={''} />
            )}
          </FormField>
        </CardContent>

        <CardFooter className="justify-between border-t pt-4">
          <div>
            {mode === 'edit' && item ? (
              <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={deleting}>
                <Trash2 className="size-4" aria-hidden />
                {deleting ? tc('saving') : t('delete')}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/inventory">{tc('cancel')}</Link>
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
  state: Extract<InventoryMutationResult, { ok: false }>,
  t: (k: string) => string,
): string {
  switch (state.code) {
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'SERIAL_TAKEN':
      return t('errors.serialTaken');
    case 'NOT_FOUND':
      return t('errors.notFound');
    case 'UNKNOWN_SUBSCRIBER':
      return t('errors.unknownSubscriber');
    case 'VALIDATION':
      return state.message ?? t('errors.validation');
    default:
      return t('errors.unexpected');
  }
}
