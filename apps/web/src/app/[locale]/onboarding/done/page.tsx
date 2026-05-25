import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@tikflow/ui';

import { Link } from '@/i18n/navigation';
import { requireSession } from '@/lib/server/session';

import { StepIndicator } from '../StepIndicator';
import { FinishButton } from './FinishButton';

type Params = { locale: string };

export default async function OnboardingDonePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession(locale);

  const [t, ts] = await Promise.all([
    getTranslations('onboarding.done'),
    getTranslations('onboarding.steps'),
  ]);

  return (
    <div className="space-y-6">
      <StepIndicator
        current="done"
        labels={{
          general: ts('general'),
          branding: ts('branding'),
          team: ts('team'),
          done: ts('done'),
        }}
      />

      <Card>
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" aria-hidden />
          </div>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription className="text-base">{t('subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
              <KeyRound className="size-5 text-primary mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium">{t('next.apiKeys.title')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('next.apiKeys.body')}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
              <ShieldCheck className="size-5 text-primary mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium">{t('next.mfa.title')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('next.mfa.body')}</p>
              </div>
            </li>
          </ul>

          <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {t('phase2Note')}
          </p>
        </CardContent>

        <CardFooter className="justify-between border-t pt-4">
          <Button asChild variant="ghost">
            <Link href="/onboarding/team">{t('back')}</Link>
          </Button>
          <FinishButton locale={locale} label={t('finish')} pendingLabel={t('finishing')} icon />
        </CardFooter>
      </Card>
    </div>
  );
}
