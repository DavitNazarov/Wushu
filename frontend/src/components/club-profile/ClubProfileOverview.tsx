'use client';

import { Activity, Layers3, MapPin, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { ClubDetailsResponse } from '@/types/clubs';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';

type Props = Pick<ClubDetailsResponse, 'club' | 'overview'>;

const kpiList = (overview: ClubDetailsResponse['overview'], t: (k: string, v?: Record<string, unknown>) => string) => [
  { icon: UserRound,  color: 'text-[var(--color-primary)]',      value: overview.totalCoaches,           label: t('overview.stats.coaches') },
  { icon: Users,      color: 'text-[var(--color-text)]',          value: overview.totalAthletes,          label: t('overview.stats.athletes') },
  { icon: ShieldCheck,color: 'text-[var(--color-success)]',       value: overview.activeAthletes,         label: t('overview.stats.activeAthletes') },
  { icon: Activity,   color: 'text-[var(--color-warning)]',       value: overview.activeRegistrations,    label: t('overview.stats.activeRegistrations') },
  { icon: Layers3,    color: 'text-[var(--color-text-muted)]',    value: overview.representedCategories,  label: t('overview.stats.categories') },
];

export function ClubProfileOverview({ club, overview }: Props) {
  const t = useTranslations('clubs.detail');
  const locale = useLocale();
  const location = formatClubLocation(club.city, club.country, t('locationMissing'));
  const cells = kpiList(overview, t as (k: string, v?: Record<string, unknown>) => string);

  return (
    <motion.div
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Hero */}
      <div className="relative overflow-hidden px-6 py-8">
        {/* Animated background orbs */}
        <motion.div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.07, 0.12, 0.07] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-indigo-500 opacity-[0.04] blur-3xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_88%,var(--color-surface-alt)_12%))]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,var(--color-primary-subtle),transparent)] opacity-50" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Club identity */}
          <div className="flex items-start gap-5">
            <motion.div
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-[22px] font-bold uppercase tracking-wider text-white shadow-[0_8px_32px_-8px_var(--color-primary)]"
              whileHover={{ scale: 1.07, rotate: 2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {club.name.slice(0, 2).toUpperCase()}
            </motion.div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]/70">
                {t('overview.eyebrow')}
              </p>
              <h2 className="mt-1 text-[24px] font-bold tracking-tight text-[var(--color-text)] leading-tight">
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

          {/* Contact */}
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)]/50 border-t border-[var(--color-border)]/60 sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
        {cells.map(({ icon: Icon, color, value, label }, i) => (
          <motion.div
            key={label}
            className="group flex cursor-default items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-[var(--color-surface-alt)]/60"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
          >
            <motion.span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] transition-colors group-hover:bg-[var(--color-surface)]"
              whileHover={{ scale: 1.12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Icon className={`h-4 w-4 ${color}`} />
            </motion.span>
            <div className="min-w-0">
              <p className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${color}`}>{value}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
