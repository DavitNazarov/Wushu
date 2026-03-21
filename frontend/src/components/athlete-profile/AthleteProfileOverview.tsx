'use client';

import { Building2, CalendarDays, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import type { AthleteProfileFightRow, AthleteProfileRegistrationRow, AthleteProfileResponse } from '@/types/api';
import { fightOutcomeForAthlete, formatAthleteDate } from './athleteProfile.utils';

type Props = {
  athlete: AthleteProfileResponse['athlete'];
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
  scope: 'admin' | 'coach' | 'public';
};

type OverviewStatProps = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
};

function OverviewStat({ label, value, hint, icon: Icon }: OverviewStatProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{hint}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export function AthleteProfileOverview({ athlete, registrations, fights, scope }: Props) {
  const t = useTranslations('athleteProfile.overview');
  const tIdentity = useTranslations('athleteProfile.identity');
  const locale = useLocale();

  const wins = fights.filter((fight) => fightOutcomeForAthlete(fight, athlete.id) === 'win').length;
  const losses = fights.filter((fight) => fightOutcomeForAthlete(fight, athlete.id) === 'loss').length;
  const pending = fights.filter((fight) => fightOutcomeForAthlete(fight, athlete.id) === 'pending').length;
  const coachCount = athlete.coaches?.length ?? 0;
  const latestRegistration = [...registrations].sort((left, right) => {
    const leftTime = new Date(left.competitionStartDate).getTime();
    const rightTime = new Date(right.competitionStartDate).getTime();
    return rightTime - leftTime;
  })[0];
  const clubMeta = [athlete.club?.city, athlete.club?.country].filter(Boolean).join(', ');

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--color-border)]/80 bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_84%,var(--color-surface-alt)_16%))] px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
              {t('eyebrow')}
            </p>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[var(--color-primary)] text-xl font-semibold uppercase tracking-[0.12em] text-white shadow-[0_18px_40px_-28px_rgba(18,59,107,0.85)]">
                {athlete.firstName.charAt(0)}
                {athlete.lastName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {athlete.fullName}
                </h2>
                <p className="mt-1 max-w-2xl text-[13px] leading-6 text-[var(--color-text-muted)]">
                  {t(`subtitle.${scope}`)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-3 py-1.5">
                    <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
                    {athlete.club?.name ?? t('unassignedClub')}
                  </span>
                  {scope !== 'public' ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-3 py-1.5">
                      <CalendarDays className="h-4 w-4 text-[var(--color-primary)]" />
                      {formatAthleteDate(athlete.dateOfBirth, locale)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-3 py-1.5">
                    <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
                    {athlete.sex ? tIdentity(`sexValue.${athlete.sex}`) : t('unspecified')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[360px] xl:grid-cols-1">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {t('facts.clubBase')}
              </p>
              <p className="mt-2 text-[14px] font-medium text-[var(--color-text)]">{clubMeta || t('clubMetaEmpty')}</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {t('facts.coaches')}
              </p>
              <p className="mt-2 text-[14px] font-medium text-[var(--color-text)]">
                {coachCount > 0 ? t('coachCount', { count: coachCount }) : t('noCoach')}
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {t('facts.latestEvent')}
              </p>
              <p className="mt-2 text-[14px] font-medium text-[var(--color-text)]">
                {latestRegistration?.eventName ?? t('noEvent')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewStat
          label={t('stats.registrations')}
          value={String(registrations.length)}
          hint={t('stats.registrationsHint')}
          icon={Users}
        />
        <OverviewStat
          label={t('stats.fights')}
          value={String(fights.length)}
          hint={t('stats.fightsHint')}
          icon={Trophy}
        />
        <OverviewStat
          label={t('stats.record')}
          value={`${wins}-${losses}`}
          hint={t('stats.recordHint')}
          icon={ShieldCheck}
        />
        <OverviewStat
          label={t('stats.pending')}
          value={String(pending)}
          hint={t('stats.pendingHint')}
          icon={CalendarDays}
        />
      </div>
    </Card>
  );
}
