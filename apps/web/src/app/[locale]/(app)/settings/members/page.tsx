import { Plus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@tikflow/ui';

import { Link } from '@/i18n/navigation';
import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listMembers } from '@/lib/server/members';
import { formatDateTime } from '@/lib/format';

type Params = { locale: string };

export default async function MembersPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [members, t] = await Promise.all([
    listMembers(session),
    getTranslations('settings.members'),
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </div>
        <Button asChild>
          <Link href="/settings/members/new">
            <Plus className="size-4" aria-hidden />
            {t('addMember')}
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {members.length === 0 ? (
          <TableEmpty>
            <p>{t('empty')}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/members/new">{t('addMember')}</Link>
            </Button>
          </TableEmpty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col.email')}</TableHead>
                <TableHead>{t('col.status')}</TableHead>
                <TableHead>{t('col.roles')}</TableHead>
                <TableHead>{t('col.mfa')}</TableHead>
                <TableHead>{t('col.lastLogin')}</TableHead>
                <TableHead className="text-right">{t('col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                        {m.email.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium">{m.email}</span>
                      {m.id === session.userId ? (
                        <Badge variant="muted">{t('you')}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} t={t} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">{t('noRoles')}</span>
                      ) : (
                        m.roles.map((r) => (
                          <Badge key={r.id} variant="primary">
                            {r.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.mfaEnabled ? (
                      <Badge variant="success">{t('mfaOn')}</Badge>
                    ) : (
                      <Badge variant="muted">{t('mfaOff')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.lastLoginAt ? formatDateTime(m.lastLoginAt, locale) : t('never')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/settings/members/${m.id}`}>{t('manage')}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: 'active' | 'invited' | 'suspended' | 'deleted';
  t: (key: string) => string;
}) {
  switch (status) {
    case 'active':
      return <Badge variant="success">{t('status.active')}</Badge>;
    case 'invited':
      return <Badge variant="warning">{t('status.invited')}</Badge>;
    case 'suspended':
      return <Badge variant="destructive">{t('status.suspended')}</Badge>;
    case 'deleted':
      return <Badge variant="muted">{t('status.deleted')}</Badge>;
  }
}
