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
import { listServicePlans } from '@/lib/server/plans';

type Params = { locale: string };

function formatSpeed(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(kbps % 1000 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} kbps`;
}

export default async function PlansPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin', 'support']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [plans, t] = await Promise.all([listServicePlans(session), getTranslations('plans')]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/plans/new">
            <Plus className="size-4" aria-hidden />
            {t('createPlan')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <TableEmpty>
              <p>{t('empty')}</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/plans/new">{t('createPlan')}</Link>
              </Button>
            </TableEmpty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col.name')}</TableHead>
                  <TableHead>{t('col.code')}</TableHead>
                  <TableHead>{t('col.type')}</TableHead>
                  <TableHead>{t('col.speed')}</TableHead>
                  <TableHead>{t('col.price')}</TableHead>
                  <TableHead>{t('col.status')}</TableHead>
                  <TableHead>{t('col.subscribers')}</TableHead>
                  <TableHead className="text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {p.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>↓ {formatSpeed(p.downloadKbps)}</div>
                      <div className="text-muted-foreground">↑ {formatSpeed(p.uploadKbps)}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {p.price.toLocaleString(locale, { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="success">{t('status.active')}</Badge>
                      ) : (
                        <Badge variant="muted">{t('status.inactive')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{p.subscriberCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/plans/${p.id}`}>{t('manage')}</Link>
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
