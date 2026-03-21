'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import type { AthleteProfileFightRow } from '@/types/api';
import { fightOutcomeForAthlete, formatAthleteDate, sortFights } from './athleteProfile.utils';

type Props = {
  athleteId: string;
  fights: AthleteProfileFightRow[];
  scope: 'admin' | 'coach' | 'public';
};

function eventHref(scope: Props['scope'], locale: string, row: AthleteProfileFightRow): string {
  if (scope === 'admin') return `/${locale}/admin/events/${row.eventId}`;
  if (scope === 'coach') return `/${locale}/coach/events/${row.eventSlug}/brackets`;
  return `/${locale}/events/${row.eventSlug}`;
}

export function AthleteProfileCompetition({ athleteId, fights, scope }: Props) {
  const t = useTranslations('athleteProfile.competition');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const rows = sortFights(fights);
  const wins = rows.filter((fight) => fightOutcomeForAthlete(fight, athleteId) === 'win').length;
  const losses = rows.filter((fight) => fightOutcomeForAthlete(fight, athleteId) === 'loss').length;
  const pending = rows.filter((fight) => fightOutcomeForAthlete(fight, athleteId) === 'pending').length;

  if (rows.length === 0) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />;
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
        </div>
        <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
          {rows.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('summary.fights')}</p>
          <p className="mt-1 text-[18px] font-semibold text-[var(--color-text)]">{rows.length}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('summary.record')}</p>
          <p className="mt-1 text-[18px] font-semibold text-[var(--color-text)]">{wins}-{losses}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('summary.pending')}</p>
          <p className="mt-1 text-[18px] font-semibold text-[var(--color-text)]">{pending}</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((fight) => {
          const outcome = fightOutcomeForAthlete(fight, athleteId);
          return (
            <Link
              key={fight.id}
              href={eventHref(scope, locale, fight)}
              className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-alt)_55%,transparent),transparent)] p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]/60"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{fight.eventName}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {t('fightLine', {
                      round: fight.round,
                      bout: fight.boutNo,
                      category: fight.categoryCode,
                    })}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {fight.opponentName ? t('opponent', { name: fight.opponentName }) : t('opponentPending')}
                  </p>
                  {fight.scheduledStartTime && (
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      {formatAthleteDate(fight.scheduledStartTime, locale)}
                      {fight.matName ? ` · ${fight.matName}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={fight.status} label={tCommon(`fightStatus.${fight.status}`)} domain="fight" />
                  <span className="rounded-[var(--radius-pill)] bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
                    {t(`outcome.${outcome}`)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
