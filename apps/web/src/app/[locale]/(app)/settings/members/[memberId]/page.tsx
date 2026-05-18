import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { MemberError, getMember } from '@/lib/server/members';
import { listRoles } from '@/lib/server/roles';

import { MemberDetailForm } from './MemberDetailForm';

type Params = { locale: string; memberId: string };
type SearchParams = { welcome?: string };

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale, memberId }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  let member;
  try {
    member = await getMember(session, memberId);
  } catch (err) {
    if (err instanceof MemberError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  const roles = await listRoles(session);
  const isSelf = member.id === session.userId;

  return (
    <MemberDetailForm
      member={member}
      roles={roles}
      isSelf={isSelf}
      locale={locale}
      justCreated={sp.welcome === '1'}
    />
  );
}
