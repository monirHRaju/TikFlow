'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@tikflow/ui';

import { Link, usePathname } from '@/i18n/navigation';

type Tab = { href: string; labelKey: 'general' | 'branding' | 'members' | 'apiKeys' | 'audit' };

const TABS: ReadonlyArray<Tab> = [
  { href: '/settings/general', labelKey: 'general' },
  // The following land in PR-1.2 through PR-1.5; we render them as disabled
  // chips so the IA is visible from day one.
  { href: '/settings/branding', labelKey: 'branding' },
  { href: '/settings/members', labelKey: 'members' },
  { href: '/settings/api-keys', labelKey: 'apiKeys' },
  { href: '/settings/audit', labelKey: 'audit' },
];

const ENABLED = new Set<string>(['/settings/general', '/settings/branding']);

export function SettingsNav() {
  const t = useTranslations('settings.tabs');
  const pathname = usePathname();

  return (
    <nav aria-label={t('navLabel')} className="flex flex-col gap-1 lg:w-56">
      {TABS.map((tab) => {
        const enabled = ENABLED.has(tab.href);
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const label = t(tab.labelKey);
        if (!enabled) {
          return (
            <span
              key={tab.href}
              aria-disabled
              className="rounded-md px-3 py-2 text-sm text-muted-foreground/70 cursor-not-allowed"
              title={t('comingSoon')}
            >
              {label}
            </span>
          );
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
