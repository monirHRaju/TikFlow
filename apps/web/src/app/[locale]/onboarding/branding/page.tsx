import { setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/lib/server/session';
import { getBranding } from '@/lib/server/tenant';

import { BrandingStep } from './BrandingStep';

type Params = { locale: string };

export default async function OnboardingBrandingPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const branding = await getBranding(session);

  return <BrandingStep branding={branding} locale={locale} />;
}
