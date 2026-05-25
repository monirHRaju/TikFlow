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
import { listApiKeys } from '@/lib/server/api-keys';
import { formatDateTime } from '@/lib/format';

import { RevokeButton } from './RevokeButton';

type Params = { locale: string };

export default async function ApiKeysPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);

  try {
    await requireRole(session, ['owner', 'admin']);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [keys, t] = await Promise.all([
    listApiKeys(session),
    getTranslations('settings.apiKeys'),
  ]);

  const now = Date.now();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </div>
        <Button asChild>
          <Link href="/settings/api-keys/new">
            <Plus className="size-4" aria-hidden />
            {t('createKey')}
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {keys.length === 0 ? (
          <TableEmpty>
            <p>{t('empty.title')}</p>
            <p className="text-xs">{t('empty.subtitle')}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/api-keys/new">{t('createKey')}</Link>
            </Button>
          </TableEmpty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col.label')}</TableHead>
                <TableHead>{t('col.prefix')}</TableHead>
                <TableHead>{t('col.scopes')}</TableHead>
                <TableHead>{t('col.expires')}</TableHead>
                <TableHead>{t('col.lastUsed')}</TableHead>
                <TableHead className="text-right">{t('col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => {
                const expired = k.expiresAt !== null && new Date(k.expiresAt).getTime() < now;
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.label}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {k.prefix}…
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="muted" className="font-mono text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {k.expiresAt ? (
                        expired ? (
                          <Badge variant="destructive">{t('expired')}</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {formatDateTime(k.expiresAt, locale)}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">{t('never')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.lastUsedAt ? formatDateTime(k.lastUsedAt, locale) : t('never')}
                    </TableCell>
                    <TableCell className="text-right">
                      <RevokeButton apiKeyId={k.id} label={k.label} locale={locale} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
