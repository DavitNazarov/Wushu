'use client';

import { ReactNode, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Menu } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';
import { TopbarToggles } from './TopbarToggles';
import { LogoutButton } from './LogoutButton';
import { MobileDrawer } from './MobileDrawer';
import { MobileNav } from './MobileNav';
import { AdminSelectedEventSummary } from './AdminSelectedEventSummary';
import { getActiveAdminNavKey } from './adminNavMatcher';
import {
  adminEventOpsShortcutKeys,
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
  const tTopbar = useTranslations('admin.topbar');
  const tEvents = useTranslations('admin.events');
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
  const selectedEvent = useMemo(
    () => {
      const matchedEvent = (events ?? []).find((ev) => ev.id === currentEventId) ?? null;
      if (routeEventMatch) return matchedEvent;
      return matchedEvent ?? (events?.length ? events[0] : null);
    },
    [currentEventId, events, routeEventMatch],
  );

  function setEventIdInUrl(nextEventId: string) {
    if (!nextEventId) return;

    if (routeEventMatch) {
      router.replace(getAdminEventPath(locale, nextEventId, routeEventMatch.page));
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('eventId', nextEventId);
    const queryString = nextSearchParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function hrefForItem(item: { key: AdminNavItemKey; href: string }) {
    const eventPage = NAV_KEY_TO_EVENT_PAGE[item.key];
    if (eventPage) {
      return selectedEvent?.id
        ? getAdminEventPath(locale, selectedEvent.id, eventPage)
        : `/${locale}/admin/events`;
    }

    if (item.key === 'integrity') {
      return selectedEvent?.id
        ? `/${locale}/admin/integrity?eventId=${encodeURIComponent(selectedEvent.id)}`
        : `/${locale}/admin/integrity`;
    }

    return `/${locale}${item.href}`;
  }

  function hrefForShortcut(key: (typeof adminEventOpsShortcutKeys)[number]) {
    const eventPage = NAV_KEY_TO_EVENT_PAGE[key];
    if (eventPage && selectedEvent?.id) {
      return getAdminEventPath(locale, selectedEvent.id, eventPage);
    }
    if (key === 'integrity' && selectedEvent?.id) {
      return `/${locale}/admin/integrity?eventId=${encodeURIComponent(selectedEvent.id)}`;
    }
    return `/${locale}/admin/events`;
  }

  function renderSidebarContent(opts: { collapsed: boolean; logoutIconOnly: boolean }) {
    const { collapsed: c, logoutIconOnly } = opts;
    return (
      <>
        <div className={`px-4 pb-2 pt-5 ${c ? 'text-center' : ''}`}>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            {c ? 'GW' : tApp('badge')}
          </span>
          {!c && (
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              {tApp('subtitle')}
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
          {adminNavSections.map((section) => (
            <div key={section.labelKey}>
              {!c && (
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  {tNav(`section_${section.labelKey}` as Parameters<typeof tNav>[0])}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = item.key === activeNavKey;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={hrefForItem(item)}
                      onClick={closeMobile}
                      title={c ? tNav(item.key as Parameters<typeof tNav>[0]) : undefined}
                      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]'
                      } ${c ? 'justify-center' : ''}`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                      {!c && (
                        <span className="truncate">
                          {tNav(item.key as Parameters<typeof tNav>[0])}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div
          className={`border-t border-[var(--color-border)] px-3 py-3 ${logoutIconOnly ? 'flex justify-center' : ''}`}
        >
          <LogoutButton iconOnly={logoutIconOnly} />
        </div>
      </>
    );
  }

  const desktopSidebarContent = renderSidebarContent({
    collapsed,
    logoutIconOnly: collapsed,
  });
  const mobileSidebarContent = renderSidebarContent({
    collapsed: false,
    logoutIconOnly: false,
  });
  const shortcutItems = adminEventOpsShortcutKeys.map((key) => ({
    key,
    href: hrefForShortcut(key),
    label: tNav(key as Parameters<typeof tNav>[0]),
  }));

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Desktop sidebar */}
      <aside
        className={`hidden flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 md:flex ${
          collapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]'
        }`}
        style={{ position: 'sticky', top: 0, height: '100vh' }}
      >
        {desktopSidebarContent}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-10 items-center justify-center border-t border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={closeMobile}
        side="left"
        overlayTop="top-14"
      >
        {mobileSidebarContent}
      </MobileDrawer>

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
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <select
                className="h-9 max-w-[260px] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                aria-label={tTopbar('eventSelectLabel')}
                value={selectedEvent?.id ?? ''}
                onChange={(e) => setEventIdInUrl(e.target.value)}
              >
                {!events?.length && (
                  <option value="">{tTopbar('noEventSelected')}</option>
                )}
                {events?.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
              {selectedEvent ? (
                <StatusChip
                  status={selectedEvent.lifecycle}
                  label={tEvents(
                    `lifecycle.${selectedEvent.lifecycle}` as Parameters<typeof tEvents>[0],
                  )}
                  domain="lifecycle"
                />
              ) : (
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {tTopbar('noEventSelected')}
                </span>
              )}
            </div>
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
            {!routeEventMatch ? (
              <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
                <AdminSelectedEventSummary
                  selectedEvent={selectedEvent}
                  emptyLabel={tTopbar('noEventSelected')}
                  shortcuts={shortcutItems}
                />
              </section>
            ) : null}
            <div>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
