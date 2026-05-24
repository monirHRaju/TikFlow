import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { InventoryError, getInventoryItem } from '@/lib/server/inventory';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listSubscribers } from '@/lib/server/subscribers';

import { InventoryForm } from '../InventoryForm';

type Params = { locale: string; itemId: string };

export default async function InventoryDetailPage({ params }: { params: Promise<Params> }) {
  const { locale, itemId } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  let item;
  try {
    item = await getInventoryItem(session, itemId);
  } catch (err) {
    if (err instanceof InventoryError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  const subscribers = await listSubscribers(session);

  return <InventoryForm mode="edit" item={item} subscribers={subscribers} locale={locale} />;
}
