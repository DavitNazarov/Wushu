'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LayoutDashboard, GitBranch, Clock, Radio, Trophy, HelpCircle } from 'lucide-react';

type TabId = 'overview' | 'brackets' | 'schedule' | 'live' | 'results' | 'faq';

type EventTabsProps = {
  overview: React.ReactNode;
  brackets: React.ReactNode;
  schedule: React.ReactNode;
  live: React.ReactNode;
  results: React.ReactNode;
  faq: React.ReactNode;
};

const TAB_IDS: TabId[] = ['overview', 'brackets', 'schedule', 'live', 'results', 'faq'];

const TAB_ICONS: Record<TabId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  brackets: GitBranch,
  schedule: Clock,
  live: Radio,
  results: Trophy,
  faq: HelpCircle,
};

function isTabId(value: string | null): value is TabId {
  return TAB_IDS.includes((value ?? '') as TabId);
}

export function EventTabs({ overview, brackets, schedule, live, results, faq }: EventTabsProps) {
  const tPublic = useTranslations('public');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab');

  const active: TabId = isTabId(tabParam) ? tabParam : 'overview';

  const setActive = useCallback(
    (tab: TabId) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: tPublic('overview') },
    { id: 'brackets', label: tPublic('brackets') },
    { id: 'schedule', label: tPublic('schedule') },
    { id: 'live', label: tPublic('live') },
    { id: 'results', label: tPublic('results') },
    { id: 'faq', label: tPublic('faq') },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-1">
          {tabs.map(({ id, label }) => {
            const Icon = TAB_ICONS[id];
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  isActive
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {active === 'overview' && overview}
      {active === 'brackets' && brackets}
      {active === 'schedule' && schedule}
      {active === 'live' && live}
      {active === 'results' && results}
      {active === 'faq' && faq}
    </div>
  );
}
