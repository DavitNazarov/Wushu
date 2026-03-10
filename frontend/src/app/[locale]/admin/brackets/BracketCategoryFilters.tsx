'use client';

import type {
  BracketCategoryFilter,
  BracketCategorySort,
} from './bracketDisplayMapper';

const FILTERS: BracketCategoryFilter[] = [
  'ALL',
  'PUBLISHED',
  'DRAFT',
  'NEEDS_REVIEW',
  'EMPTY',
  'MOVED_UP',
];

const SORTS: BracketCategorySort[] = [
  'CATEGORY',
  'ATHLETES_DESC',
  'STATUS',
  'AGE_GROUP',
  'UPDATED_DESC',
];

type Props = {
  filter: BracketCategoryFilter;
  sort: BracketCategorySort;
  onFilter: (filter: BracketCategoryFilter) => void;
  onSort: (sort: BracketCategorySort) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketCategoryFilters({
  filter,
  sort,
  onFilter,
  onSort,
  t,
}: Props) {
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => {
          const selected = value === filter;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onFilter(value)}
              className={`rounded-[var(--radius-pill)] border px-3 py-1 text-[12px] transition ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/35'
              }`}
            >
              {t(`filter.${value}`)}
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {t('sortLabel')}
        </p>
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as BracketCategorySort)}
          className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        >
          {SORTS.map((value) => (
            <option key={value} value={value}>
              {t(`sort.${value}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
