'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type TabId = 'overview' | 'brackets' | 'schedule' | 'mat';

type EventTabsProps = {
  eventSlug: string;
  overview: React.ReactNode;
  brackets: React.ReactNode;
  schedule: React.ReactNode;
  mat: React.ReactNode;
};

export function EventTabs({ eventSlug, overview, brackets, schedule, mat }: EventTabsProps) {
  const tPublic = useTranslations('public');
  const [active, setActive] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: tPublic('overview') },
    { id: 'brackets', label: tPublic('brackets') },
    { id: 'schedule', label: tPublic('schedule') },
    { id: 'mat', label: tPublic('mat') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`
              flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition
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
      {active === 'mat' && mat}
    </div>
  );
}
