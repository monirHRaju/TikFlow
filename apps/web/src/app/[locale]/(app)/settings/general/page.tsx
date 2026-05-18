import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { getCurrentTenant } from '@/lib/server/tenant';
import { CURRENCIES, TIMEZONES } from '@/lib/server/reference-data';

import { GeneralSettingsForm } from './GeneralSettingsForm';

type Params = { locale: string };

export default async function GeneralSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      // Don't reveal that the page exists to non-privileged users.
      notFound();
    }
    throw err;
  }

  const tenant = await getCurrentTenant(session);

  return (
    <GeneralSettingsForm
      tenant={tenant}
      timezones={TIMEZONES}
      currencies={CURRENCIES}
      locale={locale}
    />
  );
}
