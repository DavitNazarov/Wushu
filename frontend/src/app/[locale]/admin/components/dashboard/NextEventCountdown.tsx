'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';
import { daysUntil, formatDate } from '../../dashboard.utils';

type Props = {
  events: EventRow[];
  locale: string;
  t: (k: string) => string;
};

export function NextEventCountdown({ events, locale, t }: Props) {
  const upcoming = events
    .filter((e) => !['LIVE', 'COMPLETED'].includes(e.lifecycle))
    .sort((a, b) => new Date(a.competitionStartDate).getTime() - new Date(b.competitionStartDate).getTime());

  const next = upcoming[0];
  if (!next) return null;

  const days = daysUntil(next.competitionStartDate);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
        <span className="text-[22px] font-bold leading-none tabular-nums">{days > 0 ? days : 0}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{t('days')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('nextEvent')}
        </p>
        <p className="truncate text-[15px] font-semibold text-[var(--color-text)]">{localizedName(next.name, next.nameKa, locale)}</p>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {next.location && <><MapPin className="mb-0.5 mr-0.5 inline h-3 w-3" />{next.location} · </>}
          {formatDate(next.competitionStartDate)}
        </p>
      </div>
      <Link href={`/${locale}/admin/events`}>
        <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]" />
      </Link>
    </motion.div>
  );
}
