'use client';

import type { EventRow } from '@/types/api';
import type { WeighInQueueFilter } from '@/types/weighin';
import { INPUT_CLASS, SELECT_CLASS } from './styles';

const FILTERS: WeighInQueueFilter[] = [
  'ALL',
  'NOT_WEIGHED',
  'PASSED',
  'NEEDS_ACTION',
  'MOVED',
  'FAILED',
];

const FILTER_LABEL_KEY: Record<WeighInQueueFilter, string> = {
  ALL: 'filterAll',
  NOT_WEIGHED: 'filterNotWeighed',
  PASSED: 'filterPassed',
  NEEDS_ACTION: 'filterNeedsAction',
  MOVED: 'filterMoved',
  FAILED: 'filterFailed',
};

type Props = {
  events: EventRow[];
  selectedEventId: string;
  search: string;
  filter: WeighInQueueFilter;
  showFilters?: boolean;
  onEventChange: (eventId: string) => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: WeighInQueueFilter) => void;
  t: (key: string) => string;
};

export function WeighInToolbar({
  events,
  selectedEventId,
  search,
  filter,
  showFilters = true,
  onEventChange,
  onSearchChange,
  onFilterChange,
  t,
}: Props) {
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          className={SELECT_CLASS}
          value={selectedEventId}
          onChange={(event) => onEventChange(event.target.value)}
        >
          {events.map((eventRow) => (
            <option key={eventRow.id} value={eventRow.id}>
              {eventRow.name}
            </option>
          ))}
        </select>
        {showFilters && (
          <input
            className={`${INPUT_CLASS} w-full`}
            value={search}
            placeholder={t('searchPlaceholder')}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        )}
      </div>
      {showFilters && (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => {
            const active = item === filter;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onFilterChange(item)}
                className={`min-h-[36px] shrink-0 rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] font-medium transition ${
                  active
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t(FILTER_LABEL_KEY[item])}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
