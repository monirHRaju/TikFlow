import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tikflow/ui';

import { ForbiddenError, requireRole, requireSession } from '@/lib/server/session';
import { listRoles } from '@/lib/server/roles';

type Params = { locale: string };

export default async function RolesPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [roles, t] = await Promise.all([listRoles(session), getTranslations('settings.roles')]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cardTitle')}</CardTitle>
        <CardDescription>{t('cardSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {roles.map((role) => (
          <details
            key={role.id}
            className="group rounded-md border border-border bg-card"
            open={role.name === 'owner'}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3 min-w-0">
                <ShieldCheck className="size-5 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{role.name}</span>
                    {role.isSystem ? <Badge variant="muted">{t('systemRole')}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                    {role.description ?? t('noDescription')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <span>{t('memberCount', { count: role.memberCount })}</span>
                <span>·</span>
                <span>{t('permissionCount', { count: role.permissions.length })}</span>
              </div>
            </summary>

            <div className="border-t border-border p-4">
              {role.permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noPermissions')}</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {role.permissions.map((p) => (
                    <li
                      key={p.code}
                      className="rounded-md border border-border bg-muted/20 p-2.5"
                    >
                      <code className="text-xs font-mono">{p.code}</code>
                      {p.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}

        <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          {t('customComingSoon')}
        </p>
      </CardContent>
    </Card>
  );
}
