'use client';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { PublicClubStanding } from '@/lib/api/public-results';

type Props = {
  clubs: PublicClubStanding[];
  t: (key: string, values?: Record<string, string | number>) => string;
};

function clubKey(club: PublicClubStanding): string {
  return `${club.clubId ?? 'none'}:${club.clubName ?? 'none'}`;
}

export function PublicClubStandings({ clubs, t }: Props) {
  if (clubs.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('resultsClubsEmptyTitle')}
          description={t('resultsClubsEmptyDescription')}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {t('resultsClubStandings')}
      </p>

      <div className="grid gap-3 md:hidden">
        {clubs.map((club, index) => (
          <Card key={clubKey(club)} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  {t('resultsClubColumns.rank')} #{index + 1}
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--color-text)]">
                  {club.clubName ?? t('resultsNoClub')}
                </p>
              </div>
              <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
                {t('resultsClubColumns.total')}: {club.total}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[13px]">
              <div className="rounded-[var(--radius-input)] bg-[var(--color-warning-subtle)] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {t('resultsClubColumns.gold')}
                </p>
                <p className="mt-1 font-semibold text-[var(--color-text)]">{club.gold}</p>
              </div>
              <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {t('resultsClubColumns.silver')}
                </p>
                <p className="mt-1 font-semibold text-[var(--color-text)]">{club.silver}</p>
              </div>
              <div className="rounded-[var(--radius-input)] bg-[var(--color-success-subtle)] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {t('resultsClubColumns.bronze')}
                </p>
                <p className="mt-1 font-semibold text-[var(--color-text)]">{club.bronze}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] md:block">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[var(--color-surface-alt)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                {t('resultsClubColumns.rank')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                {t('resultsClubColumns.club')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                {t('resultsClubColumns.gold')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                {t('resultsClubColumns.silver')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                {t('resultsClubColumns.bronze')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                {t('resultsClubColumns.total')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
            {clubs.map((club, index) => (
              <tr key={clubKey(club)}>
                <td className="px-4 py-3 text-[var(--color-text)]">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                  {club.clubName ?? t('resultsNoClub')}
                </td>
                <td className="px-4 py-3 text-[var(--color-text)]">{club.gold}</td>
                <td className="px-4 py-3 text-[var(--color-text)]">{club.silver}</td>
                <td className="px-4 py-3 text-[var(--color-text)]">{club.bronze}</td>
                <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{club.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
