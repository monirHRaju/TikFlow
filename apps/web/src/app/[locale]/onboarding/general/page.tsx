import { setRequestLocale } from 'next-intl/server';

import { CURRENCIES, TIMEZONES } from '@/lib/server/reference-data';
import { requireSession } from '@/lib/server/session';
import { getCurrentTenant } from '@/lib/server/tenant';

import { GeneralStep } from './GeneralStep';

type Params = { locale: string };

export default async function OnboardingGeneralPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const tenant = await getCurrentTenant(session);

  return (
    <GeneralStep tenant={tenant} timezones={TIMEZONES} currencies={CURRENCIES} locale={locale} />
  );
}
