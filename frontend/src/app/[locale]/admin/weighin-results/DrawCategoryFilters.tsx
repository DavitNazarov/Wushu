'use client';

import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import type { DrawCategorySort } from './drawReadinessMapper';

const SORTS: DrawCategorySort[] = ['CATEGORY', 'ATHLETES_DESC', 'AGE_GROUP'];

type Props = {
  onlyWithAthletes: boolean;
  sort: DrawCategorySort;
  totalCount: number;
  shownCount: number;
  onOnlyWithAthletesChange: (value: boolean) => void;
  onSort: (value: DrawCategorySort) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function DrawCategoryFilters({
  onlyWithAthletes,
  sort,
  totalCount,
  shownCount,
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
          {t('onlyWithPassed')}
        </label>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {t('showingCategories', { shown: shownCount, total: totalCount })}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
          {t('sortLabel')}
        </Label>
        <Select value={sort} onValueChange={(v) => onSort(v as DrawCategorySort)}>
          <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`sort.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
