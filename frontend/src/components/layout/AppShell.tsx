'use client';

import { ReactNode, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';
import { TopbarToggles } from './TopbarToggles';
import { LogoutButton } from './LogoutButton';
import { MobileNav } from './MobileNav';
import { AppSidebar } from './AppSidebar';
import type { SidebarNavSection } from './AppSidebar';
import { getActiveAdminNavKey } from './adminNavMatcher';
import {
  adminNavSections,
  type AdminNavItemKey,
} from './adminNavConfig';
import {
  getAdminEventPath,
  matchAdminEventRoute,
  type AdminEventRoutePage,
} from '@/features/admin-events/lib/adminEventRoutes';

type AppShellProps = {
  children: ReactNode;
};

const NAV_KEY_TO_EVENT_PAGE: Partial<Record<AdminNavItemKey, AdminEventRoutePage>> = {
  registrations: 'registrations',
  weighin: 'weighin',
  draw: 'draw',
  brackets: 'brackets',
  schedule: 'schedule',
  live: 'live',
  results: 'results',
};

export function AppShell({ children }: AppShellProps) {
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const routeEventMatch = matchAdminEventRoute(pathname, locale);
  const activeNavKey = getActiveAdminNavKey(pathname, locale);
  const currentEventId = routeEventMatch?.eventId ?? searchParams.get('eventId') ?? '';

  const selectedEvent = useMemo(() => {
    const matched = (events ?? []).find((ev) => ev.id === currentEventId) ?? null;
    if (routeEventMatch) return matched;
    return matched ?? (events?.length ? events[0] : null);
  }, [currentEventId, events, routeEventMatch]);

  function hrefForItem(item: { key: AdminNavItemKey; href: string }) {
    const eventPage = NAV_KEY_TO_EVENT_PAGE[item.key];
    if (eventPage) {
      return selectedEvent?.id
        ? getAdminEventPath(locale, selectedEvent.id, eventPage)
        : `/${locale}/admin/events`;
    }
    if (item.key === 'display') {
      return selectedEvent?.id
        ? `/${locale}/display/${selectedEvent.id}`
        : `/${locale}/admin/events`;
    }
    if (item.key === 'integrity') {
      return selectedEvent?.id
        ? `/${locale}/admin/integrity?eventId=${encodeURIComponent(selectedEvent.id)}`
        : `/${locale}/admin/integrity`;
    }
    return `/${locale}${item.href}`;
  }

  const sidebarSections: SidebarNavSection[] = adminNavSections.map((section) => ({
    label: tNav(`section_${section.labelKey}` as Parameters<typeof tNav>[0]),
    items: section.items.map((item) => ({
      key: item.key,
      href: hrefForItem(item),
      icon: item.icon,
      label: tNav(item.key as Parameters<typeof tNav>[0]),
      active: item.key === activeNavKey,
      onClick: closeMobile,
    })),
  }));

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <AppSidebar
        badge={tApp('badge')}
        subtitle={tApp('subtitle')}
        sections={sidebarSections}
        footer={<LogoutButton />}
        footerIconOnly={<LogoutButton iconOnly />}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden lg:overflow-x-visible">
        <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] md:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
            <span className="truncate text-[13px] font-semibold text-[var(--color-text)] sm:hidden">
              {tApp('title')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MobileNav variant="dashboard" />
            <TopbarToggles />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-[1200px] space-y-4">
            <div>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
