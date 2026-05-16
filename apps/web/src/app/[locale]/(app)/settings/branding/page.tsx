import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { getBranding } from '@/lib/server/tenant';

import { BrandingForm } from './BrandingForm';

type Params = { locale: string };

export default async function BrandingSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      notFound();
    }
    throw err;
  }

  const branding = await getBranding(session);

  return <BrandingForm branding={branding} locale={locale} />;
}
