import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { API_KEY_SCOPES } from '@tikflow/contracts';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';

import { CreateApiKeyForm } from './CreateApiKeyForm';

type Params = { locale: string };

export default async function NewApiKeyPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  return <CreateApiKeyForm scopes={[...API_KEY_SCOPES]} locale={locale} />;
}
