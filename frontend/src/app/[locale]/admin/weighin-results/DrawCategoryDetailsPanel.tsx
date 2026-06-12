'use client';

import { ArrowUpRight } from 'lucide-react';
import { SkeletonRows } from '@/components/ui/Skeleton';
import type { DrawAthletePoolRow, DrawCategoryDetailsResponse } from '@/types/api';

type Props = {
  details: DrawCategoryDetailsResponse | null;
  isLoading: boolean;
  locale: string;
  editable: boolean;
  onMoveUp: (row: DrawAthletePoolRow, currentEventWeightCategoryId: string) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

function formatWeight(weightKg: number | null, locale: string): string {
  if (weightKg == null) return '—';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    weightKg,
  )} kg`;
}

export function DrawCategoryDetailsPanel({
  details,
  isLoading,
  locale,
  editable,
  onMoveUp,
  t,
}: Props) {
  if (isLoading) {
    return (
      <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <SkeletonRows rows={5} cols={3} />
      </section>
    );
  }

  if (!details) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[13px] text-[var(--color-text-muted)]">
        {t('selectCategoryPrompt')}
      </section>
    );
  }

  const category = details.category;
  // Only athletes who PASSED weigh-in are eligible — that's exactly this list.
  const athletes = details.eligibleAthletes;

  const moveUpButton = (row: DrawAthletePoolRow) =>
    editable ? (
      <button
        type="button"
        onClick={() => onMoveUp(row, category.id)}
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]"
      >
        <ArrowUpRight className="h-3 w-3" />
        {t('actionMoveUp')}
      </button>
    ) : null;

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold text-[var(--color-text)]">
            {category.categoryName}
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {category.ageGroupName}
            {category.division ? ` · ${category.division}` : ''}
          </p>
        </div>
        <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)]">
          {t('passedCount', { count: athletes.length })}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] md:block">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t('columnsAthlete')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('columnsDocument')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('columnsWeighInWeight')}</th>
              {editable && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {athletes.map((row) => (
              <tr key={row.registrationId} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium text-[var(--color-text)]">
                  {row.athleteName}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{row.athleteCode}</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-[var(--color-text)]">
                  {formatWeight(row.weighInWeightKg, locale)}
                </td>
                {editable && (
                  <td className="px-3 py-2 text-right">{moveUpButton(row)}</td>
                )}
              </tr>
            ))}
            {athletes.length === 0 && (
              <tr>
                <td
                  colSpan={editable ? 4 : 3}
                  className="px-3 py-4 text-center text-[var(--color-text-muted)]"
                >
                  {t('emptyPassedAthletes')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {athletes.map((row) => (
          <div
            key={row.registrationId}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                  {row.athleteName}
                </p>
                <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                  {row.athleteCode}
                </p>
              </div>
              <span className="shrink-0 tabular-nums text-[14px] font-semibold text-[var(--color-text)]">
                {formatWeight(row.weighInWeightKg, locale)}
              </span>
            </div>
            {editable && <div className="mt-2">{moveUpButton(row)}</div>}
          </div>
        ))}
        {athletes.length === 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-[12px] text-[var(--color-text-muted)]">
            {t('emptyPassedAthletes')}
          </div>
        )}
      </div>
    </section>
  );
}
