'use client';

import {
  LayoutDashboard,
  Users,
  Package,
  Router,
  Receipt,
  CreditCard,
  LifeBuoy,
  Building2,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@tikflow/ui';

import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from './Logo';

type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: keyof Messages['nav'];
};

type Messages = {
  nav: {
    dashboard: string;
    subscribers: string;
    plans: string;
    routers: string;
    billing: string;
    payments: string;
    tickets: string;
    resellers: string;
    settings: string;
  };
};

const NAV: NavItem[] = [
  { href: '/', icon: LayoutDashboard, labelKey: 'dashboard' },
  { href: '/subscribers', icon: Users, labelKey: 'subscribers' },
  { href: '/plans', icon: Package, labelKey: 'plans' },
  { href: '/routers', icon: Router, labelKey: 'routers' },
  { href: '/billing', icon: Receipt, labelKey: 'billing' },
  { href: '/payments', icon: CreditCard, labelKey: 'payments' },
  { href: '/tickets', icon: LifeBuoy, labelKey: 'tickets' },
  { href: '/resellers', icon: Building2, labelKey: 'resellers' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
];

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-5">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
