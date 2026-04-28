'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { PublicResultRow } from '@/lib/api/public-results';
import { localizedName } from '@/lib/bilingual';
import {
  formatPublicResultStage,
  formatPublicResultTime,
} from '@/lib/public-results';
import { PublicAthleteNameLink } from './PublicAthleteNameLink';

type Props = {
  result: PublicResultRow;
};

function cornerStyle(corner: 'RED' | 'BLUE') {
  return corner === 'RED'
    ? 'border-[var(--color-danger)]/35 bg-[var(--color-danger-subtle)]'
    : 'border-sky-500/35 bg-sky-500/12';
}

export function PublicResultCard({ result }: Props) {
  const locale = useLocale();
  const tPublic = useTranslations('public');
  const tFightStatus = useTranslations('common.fightStatus');
  const tMethods = useTranslations('live.methods');
  const stageLabel = formatPublicResultStage(result, tPublic);
  const scheduledTime = formatPublicResultTime(result.scheduledAt, locale);

  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <div className={`rounded-[var(--radius-card)] border px-4 py-3 ${cornerStyle(result.winner.corner)}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {tPublic('resultsWinner')}
            </p>
            <PublicAthleteNameLink
              athleteId={result.winner.athleteId}
              label={localizedName(result.winner.fullName, result.winner.fullNameKa, locale)}
              className="mt-1 block text-lg font-semibold text-[var(--color-text)]"
            />
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {result.winner.clubName ?? tPublic('resultsNoClub')}
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {tPublic('resultsOpponent')}
            </p>
            <PublicAthleteNameLink
              athleteId={result.opponent.athleteId}
              label={localizedName(result.opponent.fullName, result.opponent.fullNameKa, locale)}
              className="mt-1 block text-[15px] font-medium text-[var(--color-text)]"
            />
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {result.opponent.clubName ?? tPublic('resultsNoClub')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {result.method ? (
            <span className="rounded-[var(--radius-pill)] border border-[var(--color-success)]/35 bg-[var(--color-success-subtle)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text)]">
              {tMethods(result.method)}
            </span>
          ) : null}
          <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
            {tFightStatus(result.status)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[var(--color-text-muted)]">
        <span>{stageLabel}</span>
        {result.matName ? <span>• {tPublic('resultsMat', { mat: result.matName })}</span> : null}
        {scheduledTime ? <span>• {tPublic('resultsTime', { time: scheduledTime })}</span> : null}
        {result.scheduleOrder != null ? (
          <span>• {tPublic('resultsScheduleOrder', { order: result.scheduleOrder })}</span>
        ) : null}
      </div>

      {result.notes ? (
        <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
          {tPublic('resultsDecision')}: {result.notes}
        </p>
      ) : null}
    </article>
  );
}
