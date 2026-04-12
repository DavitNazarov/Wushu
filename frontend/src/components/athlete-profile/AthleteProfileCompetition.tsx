'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
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

const outcomeStyle: Record<'win' | 'loss' | 'pending', { border: string; bg: string; badge: string; dot: string }> = {
  win:     { border: 'border-l-[var(--color-success)]',  bg: '',  badge: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]',   dot: 'bg-[var(--color-success)]' },
  loss:    { border: 'border-l-[var(--color-danger)]',   bg: '',  badge: 'bg-[var(--color-danger-subtle)]  text-[var(--color-danger)]',    dot: 'bg-[var(--color-danger)]' },
  pending: { border: 'border-l-[var(--color-warning)]',  bg: '',  badge: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]',  dot: 'bg-[var(--color-warning)]' },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariant = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function AthleteProfileCompetition({ athleteId, fights, scope }: Props) {
  const t = useTranslations('athleteProfile.competition');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const rows = sortFights(fights);
  const wins = rows.filter((f) => fightOutcomeForAthlete(f, athleteId) === 'win').length;
  const losses = rows.filter((f) => fightOutcomeForAthlete(f, athleteId) === 'loss').length;
  const pending = rows.filter((f) => fightOutcomeForAthlete(f, athleteId) === 'pending').length;

  if (rows.length === 0) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)]/60 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{t('title')}</h2>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
            </div>
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
              {rows.length}
            </span>
          </div>

          {/* Record summary — flat inline stats */}
          <div className="mt-3 flex gap-5">
            <RecordStat label={t('summary.fights')} value={rows.length} color="text-[var(--color-text)]" />
            <RecordStat label={t('summary.record')} value={`${wins}–${losses}`} color="text-[var(--color-success)]" />
            <RecordStat label={t('summary.pending')} value={pending} color="text-[var(--color-warning)]" />
          </div>
        </div>

        <motion.div className="divide-y divide-[var(--color-border)]/50" variants={container} initial="hidden" animate="show">
          {rows.map((fight) => {
            const outcome = fightOutcomeForAthlete(fight, athleteId);
            const style = outcomeStyle[outcome];
            return (
              <motion.div key={fight.id} variants={itemVariant}>
                <Link
                  href={eventHref(scope, locale, fight)}
                  className={`group flex items-start justify-between gap-4 border-l-2 px-5 py-4 transition-colors hover:bg-[var(--color-surface-alt)]/50 ${style.border}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                        {fight.eventName}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>
                        {t(`outcome.${outcome}`)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {t('fightLine', { round: fight.round, bout: fight.boutNo, category: fight.categoryCode })}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {fight.opponentName ? t('opponent', { name: fight.opponentName }) : t('opponentPending')}
                    </p>
                    {fight.scheduledStartTime && (
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {formatAthleteDate(fight.scheduledStartTime, locale)}
                        {fight.matName ? ` · ${fight.matName}` : ''}
                      </p>
                    )}
                    <div className="mt-2">
                      <StatusChip status={fight.status} label={tCommon(`fightStatus.${fight.status}`)} domain="fight" />
                    </div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </Card>
    </motion.div>
  );
}

function RecordStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <p className={`text-[20px] font-bold tabular-nums leading-none tracking-tight ${color}`}>{value}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]/70">{label}</p>
    </div>
  );
}
