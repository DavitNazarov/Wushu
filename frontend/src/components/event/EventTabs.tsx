'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            aria-pressed={active === id}
            className={`
              min-w-[96px] flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition
              ${active === id
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>
      {active === 'overview' && overview}
      {active === 'brackets' && brackets}
      {active === 'schedule' && schedule}
      {active === 'live' && live}
      {active === 'results' && results}
      {active === 'faq' && faq}
    </div>
  );
}
