import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, KeyRound, Palette, Settings, Users } from 'lucide-react';

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

type Params = { locale: string };

export default async function OnboardingWelcomePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations('onboarding.welcome');

  const steps = [
    { icon: Settings, key: 'general' as const },
    { icon: Palette, key: 'branding' as const },
    { icon: Users, key: 'team' as const },
    { icon: KeyRound, key: 'apiKeys' as const },
  ];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription className="text-base">
          {t('subtitle', { email: session.email })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className="flex items-start gap-3 rounded-md border border-border bg-card p-4"
              >
                <Icon className="size-5 text-primary mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`steps.${step.key}.title`)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`steps.${step.key}.body`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{t('footnote')}</p>
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button asChild>
          <Link href="/onboarding/general">
            {t('cta')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
