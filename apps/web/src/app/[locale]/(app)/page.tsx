import { Router } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tikflow/ui';

type Params = { locale: string };

export default async function DashboardPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const kpis: Array<{ labelKey: 'subscribers' | 'mrr' | 'online' | 'openTickets'; value: string }> = [
    { labelKey: 'subscribers', value: '—' },
    { labelKey: 'mrr', value: '—' },
    { labelKey: 'online', value: '—' },
    { labelKey: 'openTickets', value: '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('welcomeSubtitle')}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.labelKey}>
            <CardHeader className="pb-2">
              <CardDescription>{t(`kpi.${kpi.labelKey}`)}</CardDescription>
              <CardTitle className="text-3xl font-semibold">{kpi.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('empty.title')}</CardTitle>
          <CardDescription>{t('empty.body')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button>
            <Router className="size-4" aria-hidden />
            {t('empty.cta')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
