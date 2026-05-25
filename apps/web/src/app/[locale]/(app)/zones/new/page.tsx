import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listZones } from '@/lib/server/zones';

import { ZoneForm } from '../ZoneForm';

type Params = { locale: string };

export default async function NewZonePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const zones = await listZones(session);

  return <ZoneForm mode="create" zone={null} candidates={zones} locale={locale} />;
}
