'use client';

import { Building2, CalendarDays, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { AthleteProfileFightRow, AthleteProfileRegistrationRow, AthleteProfileResponse } from '@/types/api';
import { fightOutcomeForAthlete, formatAthleteDate } from './athleteProfile.utils';

type Props = {
  athlete: AthleteProfileResponse['athlete'];
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
  scope: 'admin' | 'coach' | 'public';
};

type StatProps = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
};

function Stat({ label, value, hint, icon: Icon }: StatProps) {
  return (
    <motion.div
      className="group flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-md"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] opacity-70 group-hover:opacity-100 transition-opacity">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
      <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>
    </motion.div>
  );
}

export function AthleteProfileOverview({ athlete, registrations, fights, scope }: Props) {
  const t = useTranslations('athleteProfile.overview');
  const tIdentity = useTranslations('athleteProfile.identity');
  const locale = useLocale();

  const wins = fights.filter((f) => fightOutcomeForAthlete(f, athlete.id) === 'win').length;
  const losses = fights.filter((f) => fightOutcomeForAthlete(f, athlete.id) === 'loss').length;
  const pending = fights.filter((f) => fightOutcomeForAthlete(f, athlete.id) === 'pending').length;
  const coachCount = athlete.coaches?.length ?? 0;
  const latestRegistration = [...registrations].sort(
    (a, b) => new Date(b.competitionStartDate).getTime() - new Date(a.competitionStartDate).getTime(),
  )[0];
  const clubMeta = [athlete.club?.city, athlete.club?.country].filter(Boolean).join(', ');
  const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase();

  return (
    <motion.div
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero */}
      <div className="relative overflow-hidden px-6 py-7 bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_80%,var(--color-surface-alt)_20%))]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-primary-subtle),transparent_60%)] opacity-60 pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Identity */}
          <div className="flex items-start gap-5">
            <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] bg-[var(--color-primary)] text-[22px] font-bold uppercase tracking-wider text-white shadow-[0_20px_48px_-20px_rgba(18,59,107,0.9)]">
              {initials}
              <span className="absolute inset-0 rounded-[20px] ring-2 ring-white/10" />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                {t('eyebrow')}
              </p>
              <h2 className="mt-1.5 truncate text-[22px] font-semibold tracking-tight text-[var(--color-text)] leading-tight">
                {athlete.fullName}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill icon={Building2}>
                  {athlete.club?.name ?? t('unassignedClub')}
                </Pill>
                {scope !== 'public' && (
                  <Pill icon={CalendarDays}>
                    {formatAthleteDate(athlete.dateOfBirth, locale)}
                  </Pill>
                )}
                <Pill icon={ShieldCheck}>
                  {athlete.sex ? tIdentity(`sexValue.${athlete.sex}`) : t('unspecified')}
                </Pill>
              </div>
            </div>
          </div>

          {/* Sidebar facts */}
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[300px] lg:grid-cols-1">
            <FactTile label={t('facts.clubBase')} value={clubMeta || t('clubMetaEmpty')} />
            <FactTile
              label={t('facts.coaches')}
              value={coachCount > 0 ? t('coachCount', { count: coachCount }) : t('noCoach')}
            />
            <FactTile
              label={t('facts.latestEvent')}
              value={latestRegistration?.eventName ?? t('noEvent')}
            />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid gap-3 border-t border-[var(--color-border)]/60 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('stats.registrations')} value={String(registrations.length)} hint={t('stats.registrationsHint')} icon={Users} />
        <Stat label={t('stats.fights')} value={String(fights.length)} hint={t('stats.fightsHint')} icon={Trophy} />
        <Stat label={t('stats.record')} value={`${wins}–${losses}`} hint={t('stats.recordHint')} icon={ShieldCheck} />
        <Stat label={t('stats.pending')} value={String(pending)} hint={t('stats.pendingHint')} icon={CalendarDays} />
      </div>
    </motion.div>
  );
}

function Pill({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-[var(--color-primary)]" />
      {children}
    </span>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3.5 py-3 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1.5 text-[13px] font-medium leading-snug text-[var(--color-text)]">{value}</p>
    </div>
  );
}
