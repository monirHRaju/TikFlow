import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listSubscribers } from '@/lib/server/subscribers';

import { InventoryForm } from '../InventoryForm';

type Params = { locale: string };

export default async function NewInventoryItemPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const subscribers = await listSubscribers(session);

  return <InventoryForm mode="create" item={null} subscribers={subscribers} locale={locale} />;
}
