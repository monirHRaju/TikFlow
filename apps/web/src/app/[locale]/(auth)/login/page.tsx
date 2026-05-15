import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tikflow/ui';

import { LoginForm } from './LoginForm.js';

type Params = { locale: string };

export default async function LoginPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('signInTitle')}</CardTitle>
        <CardDescription>{t('signInSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-4 text-xs text-muted-foreground">{t('notWiredYet')}</p>
      </CardContent>
    </Card>
  );
}
