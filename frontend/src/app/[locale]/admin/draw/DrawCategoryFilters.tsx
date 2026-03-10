'use client';

import type {
  DrawCategoryFilter,
  DrawCategorySort,
} from './drawReadinessMapper';

const FILTERS: DrawCategoryFilter[] = [
  'ALL',
  'READY',
  'BLOCKED',
  'DRAWN',
  'EMPTY',
  'NEEDS_REVIEW',
];

const SORTS: DrawCategorySort[] = [
  'CATEGORY',
  'ATHLETES_DESC',
  'STATUS',
  'AGE_GROUP',
];

type Props = {
  filter: DrawCategoryFilter;
  onlyWithAthletes: boolean;
  sort: DrawCategorySort;
  totalCount: number;
  shownCount: number;
  onFilter: (value: DrawCategoryFilter) => void;
  onOnlyWithAthletesChange: (value: boolean) => void;
  onSort: (value: DrawCategorySort) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function DrawCategoryFilters({
  filter,
  onlyWithAthletes,
  sort,
  totalCount,
  shownCount,
  onFilter,
  onOnlyWithAthletesChange,
  onSort,
  t,
}: Props) {
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={onlyWithAthletes}
            onChange={(event) => onOnlyWithAthletesChange(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] accent-[var(--color-primary)]"
          />
          {t('onlyWithAthletes')}
        </label>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {t('showingCategories', { shown: shownCount, total: totalCount })}
        </span>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onFilter(item)}
                className={`min-h-[44px] shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition ${
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t(`filter.${item}`)}
              </button>
            );
          })}
        </div>
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as DrawCategorySort)}
          className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] lg:w-[220px]"
          aria-label={t('sortLabel')}
        >
          {SORTS.map((option) => (
            <option key={option} value={option}>
              {t(`sort.${option}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
