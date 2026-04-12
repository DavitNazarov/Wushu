'use client';

import { Card } from '@/components/ui/primitives/card';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import type {
  BracketCategoryFilter,
  BracketCategorySort,
} from '@/features/brackets/lib/bracketDisplayMapper';

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
  onlyWithAthletes: boolean;
  totalCount: number;
  shownCount: number;
  onFilter: (filter: BracketCategoryFilter) => void;
  onSort: (sort: BracketCategorySort) => void;
  onOnlyWithAthletesChange: (value: boolean) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketCategoryFilters({
  filter,
  sort,
  onlyWithAthletes,
  totalCount,
  shownCount,
  onFilter,
  onSort,
  onOnlyWithAthletesChange,
  t,
}: Props) {
  return (
    <Card className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={onlyWithAthletes}
            onChange={(e) => onOnlyWithAthletesChange(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]"
          />
          {t('onlyWithAthletes')}
        </label>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {shownCount}/{totalCount}
        </span>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((value) => {
            const selected = value === filter;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilter(value)}
                className={`min-h-[44px] shrink-0 rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] font-medium transition ${
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

        <div className="w-full space-y-1 lg:w-[220px] lg:shrink-0">
          <Label
            htmlFor="bracket-sort-select"
            className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
          >
            {t('sortLabel')}
          </Label>
          <Select
            value={sort}
            onValueChange={(value) => onSort(value as BracketCategorySort)}
          >
            <SelectTrigger
              id="bracket-sort-select"
              className="h-11 w-full bg-[var(--color-surface)] px-3"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sort.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
