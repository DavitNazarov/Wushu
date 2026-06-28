'use client';

import { Building2, CalendarDays, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { AthleteProfileFightRow, AthleteProfileRegistrationRow, AthleteProfileResponse } from '@/types/api';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import { fightOutcomeForAthlete, formatAthleteDate } from './athleteProfile.utils';

type Props = {
  athlete: AthleteProfileResponse['athlete'];
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
  scope: 'admin' | 'coach' | 'public';
};

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
  const clubs = athlete.clubs?.length ? athlete.clubs : athlete.club ? [athlete.club] : [];
  const primaryClub = athlete.club ?? clubs[0] ?? null;
  const clubLabel = primaryClub
    ? `${localizedName(primaryClub.name, primaryClub.nameKa, locale)}${clubs.length > 1 ? ` +${clubs.length - 1}` : ''}`
    : t('unassignedClub');
  const clubMeta = clubs
    .map((club) => [club.city, club.country].filter(Boolean).join(', '))
    .filter(Boolean)
    .join(' · ');
  const displayFullName = localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale);
  const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase();

  return (
    <motion.div
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero */}
      <div className="relative overflow-hidden px-6 py-8">
        <motion.div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.07, 0.12, 0.07] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-8 left-1/4 h-36 w-36 rounded-full bg-violet-500 opacity-[0.04] blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_88%,var(--color-surface-alt)_12%))]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,var(--color-primary-subtle),transparent)] opacity-50" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Identity */}
          <div className="flex items-start gap-5">
            <motion.div
              className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-[20px] font-bold uppercase tracking-wider text-white shadow-[0_8px_32px_-8px_var(--color-primary)]"
              whileHover={{ scale: 1.07, rotate: -2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {initials}
            </motion.div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]/70">
                {t('eyebrow')}
              </p>
              <h2 className="mt-1 truncate text-[22px] font-semibold tracking-tight text-[var(--color-text)] leading-tight">
                {displayFullName}
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Pill icon={Building2}>{clubLabel}</Pill>
                {scope !== 'public' && (
                  <Pill icon={CalendarDays}>{formatAthleteDate(athlete.dateOfBirth, locale)}</Pill>
                )}
                <Pill icon={ShieldCheck}>
                  {athlete.sex ? tIdentity(`sexValue.${athlete.sex}`) : t('unspecified')}
                </Pill>
              </div>
            </div>
          </div>

          {/* Fact tiles — borderless, just clean text */}
          <div className="flex flex-col gap-3.5 lg:min-w-[200px] lg:border-l lg:border-[var(--color-border)]/40 lg:pl-6">
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

      {/* Stats strip — flat, divided, no inner cards */}
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)]/50 border-t border-[var(--color-border)]/60 sm:grid-cols-4 sm:divide-y-0">
        <StatCell
          label={t('stats.registrations')}
          value={String(registrations.length)}
          hint={t('stats.registrationsHint')}
          icon={Users}
          color="text-[var(--color-primary)]"
        />
        <StatCell
          label={t('stats.fights')}
          value={String(fights.length)}
          hint={t('stats.fightsHint')}
          icon={Trophy}
          color="text-[var(--color-text)]"
        />
        <StatCell
          label={t('stats.record')}
          value={`${wins}–${losses}`}
          hint={t('stats.recordHint')}
          icon={ShieldCheck}
          color="text-[var(--color-success)]"
        />
        <StatCell
          label={t('stats.pending')}
          value={String(pending)}
          hint={t('stats.pendingHint')}
          icon={CalendarDays}
          color="text-[var(--color-warning)]"
        />
      </div>
    </motion.div>
  );
}

function Pill({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)]/60 bg-[var(--color-surface)]/70 px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] backdrop-blur-sm">
      <Icon className="h-3 w-3 text-[var(--color-primary)]/80" />
      {children}
    </span>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]/60">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium leading-snug text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function StatCell({
  label,
  value,
  hint: _hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <motion.div
      className="group flex cursor-default items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-[var(--color-surface-alt)]/60"
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <motion.span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] transition-colors group-hover:bg-[var(--color-surface)]"
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Icon className={`h-4 w-4 ${color}`} />
      </motion.span>
      <div className="min-w-0">
        <p className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${color}`}>{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      </div>
    </motion.div>
  );
}
