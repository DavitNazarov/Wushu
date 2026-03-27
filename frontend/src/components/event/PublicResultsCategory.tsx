'use client';

import type { PublicResultsCategory as PublicResultsCategoryType } from '@/lib/api/public-results';
import { PublicResultCard } from './PublicResultCard';
import { PublicResultsPlacements } from './PublicResultsPlacements';

type Props = {
  category: PublicResultsCategoryType;
  defaultOpen?: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function PublicResultsCategory({
  category,
  defaultOpen = false,
  t,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <summary className="cursor-pointer list-none px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              {category.categoryName}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {category.ageGroupName ?? t('resultsAgeGroupUnknown')}
            </p>
          </div>
          <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
            {t('resultsCount', { count: category.resultCount })}
          </span>
        </div>
      </summary>

      <div className="space-y-3 border-t border-[var(--color-border)] px-5 py-4">
        <PublicResultsPlacements placements={category.placements} t={t} />
        {category.results.map((result) => (
          <PublicResultCard key={result.id} result={result} />
        ))}
      </div>
    </details>
  );
}
