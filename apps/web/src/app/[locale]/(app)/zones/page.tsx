import { Plus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { listZones } from '@/lib/server/zones';

type Params = { locale: string };

export default async function ZonesPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin', 'support']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [zones, t] = await Promise.all([listZones(session), getTranslations('zones')]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/zones/new">
            <Plus className="size-4" aria-hidden />
            {t('createZone')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <TableEmpty>
              <p>{t('empty')}</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/zones/new">{t('createZone')}</Link>
              </Button>
            </TableEmpty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col.name')}</TableHead>
                  <TableHead>{t('col.slug')}</TableHead>
                  <TableHead>{t('col.parent')}</TableHead>
                  <TableHead>{t('col.subscribers')}</TableHead>
                  <TableHead className="text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell>
                      <div className="font-medium">{z.name}</div>
                      {z.description ? (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {z.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {z.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {z.parentName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{z.subscriberCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/zones/${z.id}`}>{t('manage')}</Link>
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
