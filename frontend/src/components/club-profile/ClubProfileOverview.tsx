'use client';

import { Activity, Layers3, MapPin, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { ClubDetailsResponse } from '@/types/clubs';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';

type Props = Pick<ClubDetailsResponse, 'club' | 'overview'>;

type KpiProps = {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
};

function Kpi({ label, value, hint, icon }: KpiProps) {
  return (
    <motion.div
      className="group flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-md"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] opacity-70 group-hover:opacity-100 transition-opacity">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
      <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>
    </motion.div>
  );
}

export function ClubProfileOverview({ club, overview }: Props) {
  const t = useTranslations('clubs.detail');
  const locale = useLocale();
  const location = formatClubLocation(club.city, club.country, t('locationMissing'));

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
          {/* Club identity */}
          <div className="flex items-start gap-4">
            <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-primary)] text-[20px] font-bold uppercase tracking-wider text-white shadow-[0_16px_40px_-18px_rgba(18,59,107,0.85)]">
              {club.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                {t('overview.eyebrow')}
              </p>
              <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-[var(--color-text)] leading-tight">
                {club.name}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[12px] text-[var(--color-text-muted)]">
                  <MapPin className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  {location}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[12px] text-[var(--color-text-muted)]">
                  {t('overview.facts.created')}: {formatClubDate(club.createdAt, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Contact fact */}
          {club.contactEmails.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-4 py-3 lg:min-w-[220px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {t('overview.facts.contacts')}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {club.contactEmails.slice(0, 2).map((email) => (
                  <p key={email} className="truncate text-[13px] font-medium text-[var(--color-text)]">
                    {email}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 border-t border-[var(--color-border)]/60 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label={t('overview.stats.coaches')} value={overview.totalCoaches} hint={t('overview.stats.coachesHint', { count: overview.activeCoachAccounts })} icon={<UserRound className="h-3.5 w-3.5" />} />
        <Kpi label={t('overview.stats.athletes')} value={overview.totalAthletes} hint={t('overview.stats.athletesHint', { male: overview.maleAthletes, female: overview.femaleAthletes })} icon={<Users className="h-3.5 w-3.5" />} />
        <Kpi label={t('overview.stats.activeAthletes')} value={overview.activeAthletes} hint={t('overview.stats.activeAthletesHint')} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <Kpi label={t('overview.stats.activeRegistrations')} value={overview.activeRegistrations} hint={t('overview.stats.activeRegistrationsHint')} icon={<Activity className="h-3.5 w-3.5" />} />
        <Kpi label={t('overview.stats.categories')} value={overview.representedCategories} hint={t('overview.stats.categoriesHint', { count: overview.representedCategories })} icon={<Layers3 className="h-3.5 w-3.5" />} />
      </div>
    </motion.div>
  );
}
