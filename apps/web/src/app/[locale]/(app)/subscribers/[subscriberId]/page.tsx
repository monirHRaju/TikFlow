import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { listServicePlans } from '@/lib/server/plans';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { SubscriberError, getSubscriber } from '@/lib/server/subscribers';
import { listZones } from '@/lib/server/zones';

import { SubscriberForm } from '../SubscriberForm';

type Params = { locale: string; subscriberId: string };

export default async function SubscriberDetailPage({ params }: { params: Promise<Params> }) {
  const { locale, subscriberId } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin', 'support']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  let subscriber;
  try {
    subscriber = await getSubscriber(session, subscriberId);
  } catch (err) {
    if (err instanceof SubscriberError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [zones, plans] = await Promise.all([listZones(session), listServicePlans(session)]);

  return (
    <SubscriberForm
      mode="edit"
      subscriber={subscriber}
      zones={zones}
      plans={plans.filter((p) => p.isActive || p.id === subscriber.currentPlan?.id)}
      locale={locale}
    />
  );
}
