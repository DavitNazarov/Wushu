'use client';

import { Activity, Layers3, MapPin, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { ClubDetailsResponse } from '@/types/clubs';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';

type Props = Pick<ClubDetailsResponse, 'club' | 'overview'>;

export function ClubProfileOverview({ club, overview }: Props) {
  const t = useTranslations('clubs.detail');
  const locale = useLocale();
  const location = formatClubLocation(club.city, club.country, t('locationMissing'));

  return (
    <motion.div
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero */}
      <div className="relative overflow-hidden px-6 py-7 bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_85%,var(--color-surface-alt)_15%))]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,var(--color-primary-subtle),transparent)] opacity-50 pointer-events-none" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Club identity */}
          <div className="flex items-start gap-5">
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-[20px] font-bold uppercase tracking-wider text-white shadow-[0_8px_32px_-8px_var(--color-primary)]">
              {club.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]/70">
                {t('overview.eyebrow')}
              </p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--color-text)] leading-tight">
                {club.name}
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)]/60 bg-[var(--color-surface)]/70 px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] backdrop-blur-sm">
                  <MapPin className="h-3 w-3 text-[var(--color-primary)]/80" />
                  {location}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)]/60 bg-[var(--color-surface)]/70 px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] backdrop-blur-sm">
                  {t('overview.facts.created')}: {formatClubDate(club.createdAt, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Contact — borderless, clean text */}
          {club.contactEmails.length > 0 && (
            <div className="flex flex-col gap-0.5 lg:min-w-[200px] lg:border-l lg:border-[var(--color-border)]/40 lg:pl-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]/60">
                {t('overview.facts.contacts')}
              </p>
              <div className="mt-0.5 space-y-0.5">
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

      {/* KPI strip — flat, icon-left layout */}
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)]/50 border-t border-[var(--color-border)]/60 sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
        <KpiCell
          label={t('overview.stats.coaches')}
          value={overview.totalCoaches}
          hint={t('overview.stats.coachesHint', { count: overview.activeCoachAccounts })}
          icon={UserRound}
          color="text-[var(--color-primary)]"
        />
        <KpiCell
          label={t('overview.stats.athletes')}
          value={overview.totalAthletes}
          hint={t('overview.stats.athletesHint', { male: overview.maleAthletes, female: overview.femaleAthletes })}
          icon={Users}
          color="text-[var(--color-text)]"
        />
        <KpiCell
          label={t('overview.stats.activeAthletes')}
          value={overview.activeAthletes}
          hint={t('overview.stats.activeAthletesHint')}
          icon={ShieldCheck}
          color="text-[var(--color-success)]"
        />
        <KpiCell
          label={t('overview.stats.activeRegistrations')}
          value={overview.activeRegistrations}
          hint={t('overview.stats.activeRegistrationsHint')}
          icon={Activity}
          color="text-[var(--color-warning)]"
        />
        <KpiCell
          label={t('overview.stats.categories')}
          value={overview.representedCategories}
          hint={t('overview.stats.categoriesHint', { count: overview.representedCategories })}
          icon={Layers3}
          color="text-[var(--color-text-muted)]"
        />
      </div>
    </motion.div>
  );
}

function KpiCell({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)]">
        <Icon className={`h-4 w-4 ${color}`} />
      </span>
      <div className="min-w-0">
        <p className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${color}`}>{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {label}
        </p>
      </div>
    </div>
  );
}
