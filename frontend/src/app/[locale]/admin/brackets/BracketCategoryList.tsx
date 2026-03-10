'use client';

import type { BracketsOverviewCategoryRow } from '@/types/api';
import { bracketStatusBadgeClasses } from './bracketDisplayMapper';

type Props = {
  rows: BracketsOverviewCategoryRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketCategoryList({ rows, selectedId, onSelect, t }: Props) {
  if (!rows.length) {
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
            className={`w-full rounded-[var(--radius-card)] border p-3 text-left transition ${
              selected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/35'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                  {row.categoryName}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  {row.ageGroupName}
                  {row.division ? ` · ${row.division}` : ''}
                </p>
              </div>

              <span
                className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${bracketStatusBadgeClasses(row.status)}`}
              >
                {t(`status.${row.status}`)}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-[var(--color-text-muted)]">
              <span>{t('rowAthletes', { count: row.athleteCount })}</span>
              <span>{t('rowFights', { count: row.fightCount })}</span>
              <span>{t('rowByes', { count: row.byesCount })}</span>
              <span>{t('rowIssues', { count: row.issueCount })}</span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
              <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-0.5">
                {t(`format.${row.competitionFormat}`)}
              </span>
              <span
                className={`rounded-[var(--radius-pill)] px-2 py-0.5 ${
                  row.publicationStatus === 'PUBLISHED'
                    ? 'border border-sky-500/30 bg-sky-500/10 text-sky-300'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                }`}
              >
                {t(`publication.${row.publicationStatus}`)}
              </span>
              {row.movedUpAthletesCount > 0 && (
                <span className="rounded-[var(--radius-pill)] border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-indigo-300">
                  {t('flagMovedUpCount', { count: row.movedUpAthletesCount })}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
