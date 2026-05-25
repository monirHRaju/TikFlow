import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { listServicePlans } from '@/lib/server/plans';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listZones } from '@/lib/server/zones';

import { SubscriberForm } from '../SubscriberForm';

type Params = { locale: string };

export default async function NewSubscriberPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [zones, plans] = await Promise.all([listZones(session), listServicePlans(session)]);

  return (
    <SubscriberForm
      mode="create"
      subscriber={null}
      zones={zones}
      plans={plans.filter((p) => p.isActive)}
      locale={locale}
    />
  );
}
