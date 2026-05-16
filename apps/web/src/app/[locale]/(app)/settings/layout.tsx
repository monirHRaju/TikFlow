import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { SettingsNav } from './SettingsNav';

type Params = { locale: string };

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<Params>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
