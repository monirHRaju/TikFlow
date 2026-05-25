'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@tikflow/ui';

import { revokeApiKeyAction } from './actions';

export function RevokeButton({
  apiKeyId,
  label,
  locale,
}: {
  apiKeyId: string;
  label: string;
  locale: string;
}) {
  const t = useTranslations('settings.apiKeys');
  const [pending, start] = useTransition();

  const onClick = () => {
    if (!confirm(t('revokeConfirm', { label }))) return;
    start(async () => {
      const result = await revokeApiKeyAction(locale, apiKeyId);
      if (!result.ok) {
        // Surface the failure inline. A toast system lands when we add
        // sonner in a later PR; for now the native alert is fine.
        alert(t(`revokeError.${result.code}`));
      }
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? t('revoking') : t('revoke')}
    </Button>
  );
}
