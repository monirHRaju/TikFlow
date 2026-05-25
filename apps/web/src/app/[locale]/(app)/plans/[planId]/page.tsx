import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { ServicePlanError, getServicePlan } from '@/lib/server/plans';

import { PlanForm } from '../PlanForm';

type Params = { locale: string; planId: string };

export default async function PlanDetailPage({ params }: { params: Promise<Params> }) {
  const { locale, planId } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  let plan;
  try {
    plan = await getServicePlan(session, planId);
  } catch (err) {
    if (err instanceof ServicePlanError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  return <PlanForm mode="edit" plan={plan} locale={locale} />;
}
