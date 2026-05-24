import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { ZoneError, getZone, listZones } from '@/lib/server/zones';

import { ZoneForm } from '../ZoneForm';

type Params = { locale: string; zoneId: string };

export default async function ZoneDetailPage({ params }: { params: Promise<Params> }) {
  const { locale, zoneId } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  let zone;
  try {
    zone = await getZone(session, zoneId);
  } catch (err) {
    if (err instanceof ZoneError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  const zones = await listZones(session);
  // Filter out self from parent candidates (cycle prevention also lives in the server lib).
  const candidates = zones.filter((z) => z.id !== zoneId);

  return <ZoneForm mode="edit" zone={zone} candidates={candidates} locale={locale} />;
}
