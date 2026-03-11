'use client';

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

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('eyebrow')}</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--color-text)]">{athlete.fullName}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('club')}</p>
          <p className="mt-1 text-[14px] text-[var(--color-text)]">{athlete.club?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('sex')}</p>
          <p className="mt-1 text-[14px] text-[var(--color-text)]">
            {athlete.sex ? t(`sexValue.${athlete.sex}`) : '—'}
          </p>
        </div>
        {scope !== 'public' && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('dateOfBirth')}</p>
            <p className="mt-1 text-[14px] text-[var(--color-text)]">{formatAthleteDate(athlete.dateOfBirth, locale)}</p>
          </div>
        )}
        {scope !== 'public' && athlete.coaches && athlete.coaches.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('coaches')}</p>
            <p className="mt-1 text-[14px] text-[var(--color-text)]">
              {athlete.coaches.map((coach) => coach.displayName).join(', ')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
