'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Award, Medal, Trophy } from 'lucide-react';
import type { AthleteMedalSummary } from '@/types/api';

type Props = {
  medals: AthleteMedalSummary;
};

type Variant = {
  /** icon + number color */
  text: string;
  /** translucent backing for the icon chip */
  chip: string;
};

const VARIANTS: Record<'gold' | 'silver' | 'bronze' | 'other', Variant> = {
  gold: { text: 'text-[var(--color-medal-gold)]', chip: 'bg-[var(--color-medal-gold-subtle)]' },
  silver: { text: 'text-[var(--color-medal-silver)]', chip: 'bg-[var(--color-medal-silver-subtle)]' },
  bronze: { text: 'text-[var(--color-medal-bronze)]', chip: 'bg-[var(--color-medal-bronze-subtle)]' },
  other: { text: 'text-[var(--color-text-muted)]', chip: 'bg-[var(--color-surface-alt)]' },
};

export function AthleteProfileMedals({ medals }: Props) {
  const t = useTranslations('athleteProfile.medals');
  const hasAny = medals.gold + medals.silver + medals.bronze + medals.other > 0;

  return (
    <motion.div
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
        </div>
        {medals.total > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-medal-gold-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-medal-gold)]">
            <Trophy className="h-3 w-3" />
            {t('medalCount', { count: medals.total })}
          </span>
        )}
      </div>

      {hasAny ? (
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)]/50 sm:grid-cols-4 sm:divide-y-0">
          <MedalCell variant={VARIANTS.gold} value={medals.gold} label={t('gold')} icon={Medal} />
          <MedalCell variant={VARIANTS.silver} value={medals.silver} label={t('silver')} icon={Medal} />
          <MedalCell variant={VARIANTS.bronze} value={medals.bronze} label={t('bronze')} icon={Medal} />
          <MedalCell variant={VARIANTS.other} value={medals.other} label={t('other')} icon={Award} />
        </div>
      ) : (
        <p className="px-5 py-6 text-center text-[13px] text-[var(--color-text-muted)]">{t('empty')}</p>
      )}
    </motion.div>
  );
}

function MedalCell({
  variant,
  value,
  label,
  icon: Icon,
}: {
  variant: Variant;
  value: number;
  label: string;
  icon: typeof Medal;
}) {
  const dimmed = value === 0;
  return (
    <motion.div
      className="group flex cursor-default items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-[var(--color-surface-alt)]/60"
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${variant.chip} ${dimmed ? 'opacity-40' : ''}`}
      >
        <Icon className={`h-4 w-4 ${variant.text}`} />
      </span>
      <div className="min-w-0">
        <p
          className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${dimmed ? 'text-[var(--color-text-muted)]' : variant.text}`}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {label}
        </p>
      </div>
    </motion.div>
  );
}
