'use client';

import { Building2, CalendarDays, ShieldCheck, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import type { AthleteProfileResponse } from '@/types/api';
import { formatAthleteDate } from './athleteProfile.utils';

type Props = {
  athlete: AthleteProfileResponse['athlete'];
  scope: 'admin' | 'coach' | 'public';
};

export function AthleteProfileIdentity({ athlete, scope }: Props) {
  const t = useTranslations('athleteProfile.identity');
  const locale = useLocale();
  const coachCount = athlete.coaches?.length ?? 0;
  const clubMeta = [athlete.club?.city, athlete.club?.country].filter(Boolean).join(', ');

  return (
    <Card className="space-y-5 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {t('eyebrow')}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--color-text)]">{athlete.fullName}</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('summary')}</p>
      </div>

      <div className="grid gap-3">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_86%,var(--color-surface-alt)_14%))] p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('club')}</p>
              <p className="mt-1 text-[15px] font-medium text-[var(--color-text)]">{athlete.club?.name ?? '—'}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{clubMeta || t('clubMetaEmpty')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-wide">{t('sex')}</p>
            </div>
            <p className="mt-2 text-[14px] font-medium text-[var(--color-text)]">
              {athlete.sex ? t(`sexValue.${athlete.sex}`) : '—'}
            </p>
          </div>

          {scope !== 'public' ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <CalendarDays className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-wide">{t('dateOfBirth')}</p>
              </div>
              <p className="mt-2 text-[14px] font-medium text-[var(--color-text)]">
                {formatAthleteDate(athlete.dateOfBirth, locale)}
              </p>
            </div>
          ) : null}
        </div>

        {scope !== 'public' ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <UserRound className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-wide">{t('coaches')}</p>
              </div>
              <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
                {coachCount}
              </span>
            </div>
            {coachCount > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {athlete.coaches?.map((coach) => (
                  <span
                    key={coach.id}
                    className="rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text)]"
                  >
                    {coach.displayName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">{t('noCoaches')}</p>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
