'use client';

import { Building2, CalendarDays, ShieldCheck, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { localizedName } from '@/lib/bilingual';
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
  const clubs = athlete.clubs?.length ? athlete.clubs : athlete.club ? [athlete.club] : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="overflow-hidden p-0">
        {/* Card header */}
        <div className="border-b border-[var(--color-border)]/60 px-5 py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]/60">
            {t('eyebrow')}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">{t('summary')}</h3>
        </div>

        <div className="divide-y divide-[var(--color-border)]/50">
          {/* Club */}
          <IdentityRow icon={Building2} label={t('club')}>
            {clubs.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {clubs.map((club) => {
                  const clubMeta = [club.city, club.country].filter(Boolean).join(', ');
                  return (
                    <div key={club.id}>
                      <p className="text-[14px] font-medium text-[var(--color-text)]">
                        {localizedName(club.name, club.nameKa, locale)}
                      </p>
                      {clubMeta && (
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                          {clubMeta}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[14px] font-medium text-[var(--color-text)]">—</p>
            )}
          </IdentityRow>

          {/* Sex */}
          <IdentityRow icon={ShieldCheck} label={t('sex')}>
            <p className="text-[14px] font-medium text-[var(--color-text)]">
              {athlete.sex ? t(`sexValue.${athlete.sex}`) : '—'}
            </p>
          </IdentityRow>

          {/* Date of birth — hidden for public */}
          {scope !== 'public' && (
            <IdentityRow icon={CalendarDays} label={t('dateOfBirth')}>
              <p className="text-[14px] font-medium text-[var(--color-text)]">
                {formatAthleteDate(athlete.dateOfBirth, locale)}
              </p>
            </IdentityRow>
          )}

          {/* Coaches */}
          <IdentityRow icon={UserRound} label={t('coaches')} badge={coachCount}>
            {coachCount > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {athlete.coaches?.map((coach) => (
                  <span
                    key={coach.id}
                    className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text)]"
                  >
                    {coach.displayName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-muted)]">{t('noCoaches')}</p>
            )}
          </IdentityRow>
        </div>
      </Card>
    </motion.div>
  );
}

function IdentityRow({
  icon: Icon,
  label,
  badge,
  children,
}: {
  icon: typeof Building2;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-alt)]/30">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]/50" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            {label}
          </p>
          {badge !== undefined && badge > 0 && (
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
