import { Plus, Search } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { SubscriberStatus } from '@tikflow/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@tikflow/ui';

import { Link } from '@/i18n/navigation';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listSubscribers } from '@/lib/server/subscribers';

type Params = { locale: string };
type SearchParams = { q?: string; status?: string };

const STATUS_COLOR: Record<SubscriberStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'destructive',
  cancelled: 'muted',
};

export default async function SubscribersPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin', 'support']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const status =
    sp.status === 'active' || sp.status === 'pending' || sp.status === 'suspended' || sp.status === 'cancelled'
      ? (sp.status as SubscriberStatus)
      : undefined;

  const [subscribers, t] = await Promise.all([
    listSubscribers(session, { q: sp.q, ...(status ? { status } : {}) }),
    getTranslations('subscribers'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/subscribers/new">
            <Plus className="size-4" aria-hidden />
            {t('createSubscriber')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Server-rendered filter form. Submitting reloads the page with q/status query params. */}
          <form method="GET" className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Select name="status" defaultValue={status ?? ''} className="w-44">
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="pending">{t('status.pending')}</option>
              <option value="suspended">{t('status.suspended')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </Select>
            <Button type="submit" variant="outline">
              {t('apply')}
            </Button>
          </form>

          {subscribers.length === 0 ? (
            <TableEmpty>
              <p>{sp.q || sp.status ? t('emptyFiltered') : t('empty')}</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/subscribers/new">{t('createSubscriber')}</Link>
              </Button>
            </TableEmpty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col.code')}</TableHead>
                  <TableHead>{t('col.name')}</TableHead>
                  <TableHead>{t('col.phone')}</TableHead>
                  <TableHead>{t('col.zone')}</TableHead>
                  <TableHead>{t('col.plan')}</TableHead>
                  <TableHead>{t('col.status')}</TableHead>
                  <TableHead className="text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {s.code}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell className="font-mono text-sm">{s.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.zone?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.currentPlan ? (
                        <span>
                          {s.currentPlan.name}{' '}
                          <span className="text-muted-foreground">
                            ({s.currentPlan.price.toLocaleString(locale)})
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLOR[s.status]}>{t(`status.${s.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/subscribers/${s.id}`}>{t('manage')}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
