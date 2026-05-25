import { setRequestLocale } from 'next-intl/server';

import { listMembers } from '@/lib/server/members';
import { listRoles } from '@/lib/server/roles';
import { requireSession } from '@/lib/server/session';

import { TeamStep } from './TeamStep';

type Params = { locale: string };

export default async function OnboardingTeamPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  const [members, roles] = await Promise.all([listMembers(session), listRoles(session)]);

  return <TeamStep members={members} roles={roles} locale={locale} />;
}
