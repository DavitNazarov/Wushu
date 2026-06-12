'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

type TabId =
  | 'overview'
  | 'weights'
  | 'brackets'
  | 'schedule'
  | 'live'
  | 'results'
  | 'faq';

type EventTabsProps = {
  overview: React.ReactNode;
  weights: React.ReactNode;
  brackets: React.ReactNode;
  schedule: React.ReactNode;
  live: React.ReactNode;
  results: React.ReactNode;
  faq: React.ReactNode;
};

const TAB_IDS: TabId[] = [
  'overview',
  'weights',
  'brackets',
  'schedule',
  'live',
  'results',
  'faq',
];

function isTabId(value: string | null): value is TabId {
  return TAB_IDS.includes((value ?? '') as TabId);
}

export function EventTabs({ overview, weights, brackets, schedule, live, results, faq }: EventTabsProps) {
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
    { id: 'weights', label: tPublic('weights') },
    { id: 'brackets', label: tPublic('brackets') },
    { id: 'schedule', label: tPublic('schedule') },
    { id: 'live', label: tPublic('live') },
    { id: 'results', label: tPublic('results') },
    { id: 'faq', label: tPublic('faq') },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar — underline style, scrollable on mobile */}
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max border-b border-[var(--color-border)]">
          {tabs.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                aria-pressed={isActive}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none ${
                  isActive
                    ? 'border-[var(--color-primary)] text-[var(--color-text)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {active === 'overview' && overview}
      {active === 'weights' && weights}
      {active === 'brackets' && brackets}
      {active === 'schedule' && schedule}
      {active === 'live' && live}
      {active === 'results' && results}
      {active === 'faq' && faq}
    </div>
  );
}
