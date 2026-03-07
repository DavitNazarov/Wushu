'use client';

import { ReactNode, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
  UserCircle2,
  Users,
  ClipboardList,
  Scale,
  ShieldCheck,
  Shuffle,
  GitBranch,
  Clock,
  Radio,
  Trophy,
  Building2,
  Newspaper,
  Inbox,
  Menu,
  ChevronLeft,
} from 'lucide-react';
import { TopbarToggles } from './TopbarToggles';
import { LogoutButton } from './LogoutButton';
import { MobileDrawer } from './MobileDrawer';
import { MobileNav } from './MobileNav';

type NavItem = {
  key: string;
  href: string;
  icon: typeof LayoutDashboard;
};

type NavSection = {
  labelKey: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    labelKey: 'overview',
    items: [
      { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
      { key: 'events', href: '/admin/events', icon: Calendar },
    ],
  },
  {
    labelKey: 'tournament',
    items: [
      { key: 'registrations', href: '/admin/registrations', icon: ClipboardList },
      { key: 'weighin', href: '/admin/weighin', icon: Scale },
      { key: 'integrity', href: '/admin/integrity', icon: ShieldCheck },
      { key: 'draw', href: '/admin/draw', icon: Shuffle },
      { key: 'brackets', href: '/admin/brackets', icon: GitBranch },
      { key: 'schedule', href: '/admin/schedule', icon: Clock },
      { key: 'live', href: '/admin/live', icon: Radio },
      { key: 'results', href: '/admin/results', icon: Trophy },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { key: 'clubs', href: '/admin/clubs', icon: Building2 },
      { key: 'athletes', href: '/admin/athletes', icon: UserCircle2 },
    ],
  },
  {
    labelKey: 'admin',
    items: [
      { key: 'users', href: '/admin/users', icon: Users },
      { key: 'rulesets', href: '/admin/rulesets', icon: FileText },
      { key: 'news', href: '/admin/news', icon: Newspaper },
      { key: 'inbox', href: '/admin/inbox', icon: Inbox },
      { key: 'settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  function isActive(href: string) {
    return href === '/admin'
      ? pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`
      : pathname.startsWith(`/${locale}${href}`);
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
          {navSections.map((section) => (
            <div key={section.labelKey}>
              {!c && (
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  {tNav(`section_${section.labelKey}` as Parameters<typeof tNav>[0])}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={`/${locale}${item.href}`}
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
              {tApp('title')}
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
