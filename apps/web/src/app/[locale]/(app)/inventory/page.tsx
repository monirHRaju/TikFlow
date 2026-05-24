import { Plus, Search } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { InventoryItemStatus, InventoryItemType } from '@tikflow/contracts';
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
import { listInventoryItems } from '@/lib/server/inventory';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';

type Params = { locale: string };
type SearchParams = { q?: string; status?: string; type?: string };

const STATUS_VARIANT: Record<
  InventoryItemStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'primary'
> = {
  in_stock: 'success',
  allocated: 'primary',
  deployed: 'muted',
  faulty: 'destructive',
  returned: 'warning',
  scrapped: 'destructive',
};

const VALID_STATUSES: InventoryItemStatus[] = [
  'in_stock',
  'allocated',
  'deployed',
  'faulty',
  'returned',
  'scrapped',
];
const VALID_TYPES: InventoryItemType[] = [
  'ont',
  'onu',
  'router',
  'switch',
  'splitter',
  'cable_drum',
  'nic',
  'antenna',
  'other',
];

export default async function InventoryPage({
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

  const status = (VALID_STATUSES as string[]).includes(sp.status ?? '')
    ? (sp.status as InventoryItemStatus)
    : undefined;
  const type = (VALID_TYPES as string[]).includes(sp.type ?? '')
    ? (sp.type as InventoryItemType)
    : undefined;

  const [items, t] = await Promise.all([
    listInventoryItems(session, {
      q: sp.q,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    }),
    getTranslations('inventory'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/inventory/new">
            <Plus className="size-4" aria-hidden />
            {t('createItem')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Select name="type" defaultValue={type ?? ''} className="w-40">
              <option value="">{t('allTypes')}</option>
              {VALID_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {t(`type.${tt}`)}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={status ?? ''} className="w-40">
              <option value="">{t('allStatuses')}</option>
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              {t('apply')}
            </Button>
          </form>

          {items.length === 0 ? (
            <TableEmpty>
              <p>{sp.q || sp.status || sp.type ? t('emptyFiltered') : t('empty')}</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/inventory/new">{t('createItem')}</Link>
              </Button>
            </TableEmpty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col.type')}</TableHead>
                  <TableHead>{t('col.serial')}</TableHead>
                  <TableHead>{t('col.model')}</TableHead>
                  <TableHead>{t('col.location')}</TableHead>
                  <TableHead>{t('col.status')}</TableHead>
                  <TableHead>{t('col.subscriber')}</TableHead>
                  <TableHead className="text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Badge variant="outline">{t(`type.${i.type}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      {i.serial ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {i.serial}
                        </code>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {i.vendor || i.model ? (
                        <div>
                          <div>{i.model ?? '—'}</div>
                          {i.vendor ? <div className="text-muted-foreground text-xs">{i.vendor}</div> : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {i.location ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[i.status]}>{t(`status.${i.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {i.subscriber ? (
                        <Link
                          href={`/subscribers/${i.subscriber.id}`}
                          className="hover:underline"
                        >
                          {i.subscriber.fullName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/inventory/${i.id}`}>{t('manage')}</Link>
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
