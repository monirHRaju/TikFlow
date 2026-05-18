import { redirect } from '@/i18n/navigation';

type Params = { locale: string };

export default async function OnboardingIndexPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  redirect({ href: '/onboarding/welcome', locale });
}
