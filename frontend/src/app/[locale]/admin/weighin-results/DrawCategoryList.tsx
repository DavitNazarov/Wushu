'use client';

import type { DrawCategoryOverviewRow } from '@/types/api';

type Props = {
  rows: DrawCategoryOverviewRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function DrawCategoryList({ rows, selectedId, onSelect, t }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[13px] text-[var(--color-text-muted)]">
        {t('emptyCategoryList')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className={`min-h-[44px] w-full overflow-hidden rounded-[var(--radius-card)] border p-3 text-left transition ${
              selected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/35'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                  {row.categoryName}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                  {row.ageGroupName}
                  {row.division ? ` · ${row.division}` : ''}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${
                  row.eligibleAthletesCount > 0
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                }`}
              >
                {t('passedCountShort', { count: row.eligibleAthletesCount })}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
