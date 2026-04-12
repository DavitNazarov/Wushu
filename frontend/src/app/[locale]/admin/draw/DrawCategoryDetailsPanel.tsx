'use client';

import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
import type { DrawAthletePoolRow, DrawCategoryDetailsResponse } from '@/types/api';
import { statusBadgeClasses } from './drawReadinessMapper';

type Props = {
  details: DrawCategoryDetailsResponse | null;
  isLoading: boolean;
  eventId: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  onReassign: (row: DrawAthletePoolRow) => void;
};

function Badge({ label, tone }: { label: string; tone: 'info' | 'warning' }) {
  return (
    <span
      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${
        tone === 'warning'
          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border border-sky-500/30 bg-sky-500/10 text-sky-300'
      }`}
    >
      {label}
    </span>
  );
}

export function DrawCategoryDetailsPanel({ details, isLoading, eventId: _eventId, t, onReassign }: Props) {
  if (isLoading) {
    return (
      <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <SkeletonRows rows={4} cols={4} />
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
  const statusVariant =
    category.readinessStatus === 'BLOCKED'
      ? 'error'
      : category.readinessStatus === 'NEEDS_REVIEW'
      ? 'warning'
      : 'success';

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
        <span className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-semibold ${statusBadgeClasses(category.readinessStatus)}`}>
          {t(`status.${category.readinessStatus}`)}
        </span>
      </div>

      <InlineAlert variant={statusVariant}>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">{t(`status.${category.readinessStatus}`)}</p>
          <p className="text-[12px]">
            {t('categoryReadinessSummary', {
              eligible: category.eligibleAthletesCount,
              excluded: category.excludedAthletesCount,
              issues: category.issueCount,
            })}
          </p>
        </div>
      </InlineAlert>

      {category.issues.length > 0 && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3">
          <p className="text-[12px] font-semibold text-[var(--color-text)]">
            {t('categoryIssuesTitle')}
          </p>
          <div className="mt-2 space-y-1">
            {category.issues.map((issue) => (
              <p key={issue.code} className="text-[12px] text-[var(--color-text-muted)]">
                {t(`issueCode.${issue.code}`)} ({issue.count})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--color-text)]">
            {t('eligibleAthletesTitle')}
          </h3>
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {details.eligibleAthletes.length}
          </span>
        </div>

        <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] md:block">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-2 py-2 text-left font-medium">{t('columnsAthlete')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsClub')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsOriginalCategory')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsFinalCategory')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsWeighInStatus')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsFlags')}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {details.eligibleAthletes.map((row) => (
                <tr key={row.registrationId} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-2 text-[var(--color-text)]">
                    <p>{row.athleteName}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{row.athleteCode}</p>
                  </td>
                  <td className="px-2 py-2 text-[var(--color-text)]">{row.clubName ?? '—'}</td>
                  <td className="px-2 py-2 text-[var(--color-text)]">{row.originalCategory ?? '—'}</td>
                  <td className="px-2 py-2 text-[var(--color-text)]">{row.finalCategory ?? '—'}</td>
                  <td className="px-2 py-2 text-[var(--color-text)]">{t(`weighInStatus.${row.weighInStatus}`)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.movedUp && <Badge label={t('flagMovedUp')} tone="info" />}
                      {row.overrideUsed && <Badge label={t('flagOverride')} tone="warning" />}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onReassign(row)}
                      className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]"
                    >
                      Reassign ↑
                    </button>
                  </td>
                </tr>
              ))}
              {details.eligibleAthletes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-[var(--color-text-muted)]">
                    {t('emptyEligibleAthletes')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 md:hidden">
          {details.eligibleAthletes.map((row) => (
            <div
              key={row.registrationId}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3"
            >
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                {row.athleteName}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{row.athleteCode}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {row.clubName ?? '—'} · {row.originalCategory ?? '—'} → {row.finalCategory ?? '—'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[var(--color-text)]">
                  {t(`weighInStatus.${row.weighInStatus}`)}
                </span>
                {row.movedUp && <Badge label={t('flagMovedUp')} tone="info" />}
                {row.overrideUsed && <Badge label={t('flagOverride')} tone="warning" />}
                <button
                  type="button"
                  onClick={() => onReassign(row)}
                  className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]"
                >
                  Reassign ↑
                </button>
              </div>
            </div>
          ))}
          {details.eligibleAthletes.length === 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-[12px] text-[var(--color-text-muted)]">
              {t('emptyEligibleAthletes')}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--color-text)]">
            {t('excludedAthletesTitle')}
          </h3>
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {details.excludedAthletes.length}
          </span>
        </div>

        <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] md:block">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-2 py-2 text-left font-medium">{t('columnsAthlete')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsRegistrationStatus')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsWeighInStatus')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('columnsExclusionReason')}</th>
              </tr>
            </thead>
            <tbody>
              {details.excludedAthletes.map((row) => (
                <tr key={row.registrationId} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-2 text-[var(--color-text)]">
                    <p>{row.athleteName}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{row.athleteCode}</p>
                  </td>
                  <td className="px-2 py-2 text-[var(--color-text)]">{t(`registrationStatus.${row.registrationStatus}`)}</td>
                  <td className="px-2 py-2 text-[var(--color-text)]">{t(`weighInStatus.${row.weighInStatus}`)}</td>
                  <td className="px-2 py-2 text-[var(--color-text)]">
                    {row.exclusionReasonCode ? t(`issueCode.${row.exclusionReasonCode}`) : '—'}
                  </td>
                </tr>
              ))}
              {details.excludedAthletes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-[var(--color-text-muted)]">
                    {t('emptyExcludedAthletes')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 md:hidden">
          {details.excludedAthletes.map((row) => (
            <div
              key={row.registrationId}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3"
            >
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                {row.athleteName}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{row.athleteCode}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {t(`registrationStatus.${row.registrationStatus}`)} · {t(`weighInStatus.${row.weighInStatus}`)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-text)]">
                {row.exclusionReasonCode ? t(`issueCode.${row.exclusionReasonCode}`) : '—'}
              </p>
            </div>
          ))}
          {details.excludedAthletes.length === 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-[12px] text-[var(--color-text-muted)]">
              {t('emptyExcludedAthletes')}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
