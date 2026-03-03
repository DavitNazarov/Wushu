'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  Settings,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { TopbarToggles } from './TopbarToggles';
import { Card } from '@/components/ui/Card';

type AppShellProps = {
  title: ReactNode;
  children: ReactNode;
};

const navItems: {
  key: 'dashboard' | 'events' | 'rulesets' | 'users' | 'settings';
  href: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
  { key: 'events', href: '/admin/events', icon: Calendar },
  { key: 'rulesets', href: '/admin/rulesets', icon: FileText },
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'settings', href: '/admin/settings', icon: Settings },
];

export function AppShell({ title, children }: AppShellProps) {
  const tApp = useTranslations('app');
  const tAdmin = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname() ?? '';

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="mx-auto flex min-h-screen max-w-[1200px]">
        <aside className="hidden w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] py-6 sm:flex sm:flex-col">
          <div className="mb-8 px-4">
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {tApp('badge')}
            </span>
            <div className="mt-3 text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {tApp('subtitle')}
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`
                  : pathname.startsWith(`/${locale}${item.href}`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={`/${locale}${item.href}`}
                  className={`flex items-center gap-3 rounded-[var(--radius-input)] px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {tAdmin(`sidebar.${item.key}`)}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold text-[var(--color-text)]">
                {tApp('title')}
              </h1>
              <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-muted)]">
                {tApp('tagline')}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden items-center gap-3 sm:flex">
                <div className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)]">
                  {tAdmin('topbar.noEventSelected')}
                </div>
                <div className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {tApp('statusLive')}
                </div>
              </div>

              <TopbarToggles />
            </div>
          </header>

          <main className="flex-1 px-6 py-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h2>
              </div>
              <Card>{children}</Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
