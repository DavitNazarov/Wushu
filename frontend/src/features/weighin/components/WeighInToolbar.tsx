'use client';

import { AdminEventSelect } from '@/components/admin/AdminEventSelect';
import { Card } from '@/components/ui/primitives/card';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import type { EventRow } from '@/types/api';
import type { WeighInQueueFilter } from '@/types/weighin';

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
    <Card className="space-y-3 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <AdminEventSelect
          label={t('eventLabel')}
          value={selectedEventId}
          placeholder={t('eventPlaceholder')}
          events={events}
          onValueChange={onEventChange}
          className="lg:min-w-[18rem]"
        />
        {showFilters && (
          <div className="flex w-full min-w-[14rem] flex-col gap-1">
            <Label
              htmlFor="weighin-search-filter"
              className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]"
            >
              {t('searchLabel')}
            </Label>
            <Input
              id="weighin-search-filter"
              type="search"
              autoComplete="off"
              className="h-10 bg-[var(--color-surface)]"
              value={search}
              placeholder={t('searchPlaceholder')}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
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
    </Card>
  );
}
