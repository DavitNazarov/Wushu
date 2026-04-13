'use client';

import { ReactNode, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Calendar, LayoutDashboard, UserCircle2, Users, Menu } from 'lucide-react';
import { TopbarToggles } from './TopbarToggles';
import { LogoutButton } from './LogoutButton';
import { MobileNav } from './MobileNav';
import { AppSidebar } from './AppSidebar';
import type { SidebarNavSection } from './AppSidebar';

type CoachShellProps = {
  children: ReactNode;
};

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  events:    Calendar,
  athletes:  Users,
  me:        UserCircle2,
} as const;

const NAV_HREFS: Record<keyof typeof NAV_ICONS, string> = {
  dashboard: '/coach',
  events:    '/coach/events',
  athletes:  '/coach/athletes',
  me:        '/coach/me',
};

function resolveActive(href: string, pathname: string, locale: string): boolean {
  if (href === '/coach')    return pathname === `/${locale}/coach` || pathname === `/${locale}/coach/`;
  if (href === '/coach/me') return pathname === `/${locale}/coach/me` || pathname === `/${locale}/coach/me/`;
  return pathname.startsWith(`/${locale}${href}`);
}

export function CoachShell({ children }: CoachShellProps) {
  const tApp   = useTranslations('app');
  const tNav   = useTranslations('nav');
  const tCoach = useTranslations('coach');
  const locale  = useLocale();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const sections: SidebarNavSection[] = [
    {
      items: (Object.keys(NAV_HREFS) as Array<keyof typeof NAV_HREFS>).map((key) => ({
        key,
        href:   `/${locale}${NAV_HREFS[key]}`,
        icon:   NAV_ICONS[key],
        label:  tNav(key as Parameters<typeof tNav>[0]),
        active: resolveActive(NAV_HREFS[key], pathname, locale),
        onClick: closeMobile,
      })),
    },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <AppSidebar
        badge={tApp('badge')}
        subtitle={tCoach('sidebarSubtitle')}
        sections={sections}
        footer={<LogoutButton />}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />

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
