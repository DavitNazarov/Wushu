'use client';

import { ReactNode, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Calendar, LayoutDashboard, UserCircle2, Users, Menu } from 'lucide-react';
import { TopbarToggles } from './TopbarToggles';
import { LogoutButton } from './LogoutButton';
import { MobileDrawer } from './MobileDrawer';
import { MobileNav } from './MobileNav';

type NavItem = {
  key: string;
  href: string;
  icon: typeof Calendar;
};

const navItems: NavItem[] = [
  { key: 'dashboard', href: '/coach', icon: LayoutDashboard },
  { key: 'events', href: '/coach/events', icon: Calendar },
  { key: 'athletes', href: '/coach/athletes', icon: Users },
  { key: 'me', href: '/coach/me', icon: UserCircle2 },
];

type CoachShellProps = {
  children: ReactNode;
};

export function CoachShell({ children }: CoachShellProps) {
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const tCoach = useTranslations('coach');
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  function isActive(href: string) {
    return href === '/coach'
      ? pathname === `/${locale}/coach` || pathname === `/${locale}/coach/`
      : href === '/coach/me'
      ? pathname === `/${locale}/coach/me` || pathname === `/${locale}/coach/me/`
      : pathname.startsWith(`/${locale}${href}`);
  }

  const sidebarContent = (
    <>
      <div className="px-4 pb-2 pt-5">
        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
          {tApp('badge')}
        </span>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          {tCoach('sidebarSubtitle')}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={`/${locale}${item.href}`}
                onClick={closeMobile}
                title={tNav(item.key as Parameters<typeof tNav>[0])}
                className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                <span className="truncate">{tNav(item.key as Parameters<typeof tNav>[0])}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-[var(--color-border)] px-3 py-3">
        <LogoutButton />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Desktop sidebar */}
      <aside
        className="hidden w-[var(--sidebar-width)] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex"
        style={{ position: 'sticky', top: 0, height: '100vh' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={closeMobile}
        side="left"
        overlayTop="top-14"
      >
        {sidebarContent}
      </MobileDrawer>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] md:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
            <span className="text-[13px] font-semibold text-[var(--color-text)]">
              {tCoach('title')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MobileNav variant="dashboard" />
            <TopbarToggles />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
