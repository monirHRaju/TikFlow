import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listRoles } from '@/lib/server/roles';

import { AddMemberForm } from './AddMemberForm';

type Params = { locale: string };

export default async function NewMemberPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const roles = await listRoles(session);

  return <AddMemberForm roles={roles} locale={locale} />;
}
