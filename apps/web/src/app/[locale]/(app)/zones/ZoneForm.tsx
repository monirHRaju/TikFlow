'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';

import type { ZoneSummary } from '@tikflow/contracts';
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
  createZoneAction,
  deleteZoneAction,
  updateZoneAction,
  type ZoneMutationResult,
} from './actions';

type Props = {
  mode: 'create' | 'edit';
  zone: ZoneSummary | null;
  candidates: ZoneSummary[];
  locale: string;
};

export function ZoneForm({ mode, zone, candidates, locale }: Props) {
  const t = useTranslations('zones.form');
  const tc = useTranslations('common');
  const router = useRouter();
  const [deleting, startDelete] = useTransition();

  const [state, formAction] = useActionState<ZoneMutationResult | null, FormData>(
    async (prev, fd) =>
      mode === 'create'
        ? createZoneAction(locale, prev, fd)
        : updateZoneAction(locale, zone!.id, prev, fd),
    null,
  );

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  const handleDelete = () => {
    if (!zone) return;
    if (!confirm(t('deleteConfirm', { name: zone.name }))) return;
    startDelete(async () => {
      const res = await deleteZoneAction(locale, zone.id);
      if (res.ok) router.push('/zones');
      else alert(mutationCopy(res, t));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7">
            <Link href="/zones">
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
                <AlertDescription>{mutationCopy(state, t)}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormField label={t('name')} error={fieldErrors?.name?.[0]} required>
            {({ id, errorId }) => (
              <Input
                id={id}
                name="name"
                type="text"
                required
                maxLength={120}
                defaultValue={zone?.name ?? ''}
                aria-describedby={errorId}
                aria-invalid={Boolean(fieldErrors?.name)}
              />
            )}
          </FormField>

          <FormField
            label={t('slug')}
            description={t('slugHelp')}
            error={fieldErrors?.slug?.[0]}
            required
          >
            {({ id, descriptionId, errorId }) => (
              <Input
                id={id}
                name="slug"
                type="text"
                required
                defaultValue={zone?.slug ?? ''}
                className="font-mono"
                aria-describedby={errorId ?? descriptionId}
                aria-invalid={Boolean(fieldErrors?.slug)}
              />
            )}
          </FormField>

          <FormField label={t('parent')} description={t('parentHelp')} error={fieldErrors?.parentId?.[0]}>
            {({ id }) => (
              <Select id={id} name="parentId" defaultValue={zone?.parentId ?? ''}>
                <option value="">{t('noParent')}</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label={t('description')} error={fieldErrors?.description?.[0]}>
            {({ id }) => (
              <Textarea
                id={id}
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={zone?.description ?? ''}
              />
            )}
          </FormField>
        </CardContent>

        <CardFooter className="justify-between border-t pt-4">
          <div>
            {mode === 'edit' && zone ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || zone.subscriberCount > 0}
              >
                <Trash2 className="size-4" aria-hidden />
                {deleting ? tc('saving') : t('delete')}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/zones">{tc('cancel')}</Link>
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

function mutationCopy(
  state: Extract<ZoneMutationResult, { ok: false }>,
  t: (k: string, params?: Record<string, string>) => string,
): string {
  switch (state.code) {
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'SLUG_TAKEN':
      return t('errors.slugTaken');
    case 'NOT_FOUND':
      return t('errors.notFound');
    case 'IN_USE':
      return t('errors.inUse');
    case 'PARENT_CYCLE':
      return t('errors.parentCycle');
    case 'VALIDATION':
      return state.message ?? t('errors.validation');
    default:
      return t('errors.unexpected');
  }
}
