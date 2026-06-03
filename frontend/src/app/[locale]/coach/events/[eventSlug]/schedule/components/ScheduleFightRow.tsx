'use client';

import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/StatusChip';
import { localizedName } from '@/lib/bilingual';
import type { ScheduleFightRow as Fight } from '@/types/api';

type Props = {
  fight: Fight;
  idx: number;
  lastIdx: number;
  locale: string;
};

export function ScheduleFightRow({ fight, idx, lastIdx, locale }: Props) {
  const tC = useTranslations('common');
  const isRunning = fight.liveStatus === 'RUNNING';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.03, duration: 0.25, ease: 'easeOut' }}
      className={`flex items-center gap-3 px-4 py-3 ${
        idx < lastIdx ? 'border-b border-[var(--color-border)]' : ''
      } ${isRunning ? 'bg-[var(--color-primary)]/5' : ''}`}
    >
      <div className="w-10 shrink-0 text-center">
        {isRunning ? (
          <span className="relative flex h-2.5 w-2.5 mx-auto">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
          </span>
        ) : (
          <p className="text-[12px] font-semibold tabular-nums text-[var(--color-text-muted)]">
            #{fight.scheduleOrder ?? '—'}
          </p>
        )}
      </div>

      <div className="h-8 w-px shrink-0 bg-[var(--color-border)]" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`truncate text-[13px] font-medium ${isRunning ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
            {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)}
          </span>
          <Swords className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
          <span className={`truncate text-[13px] font-medium ${isRunning ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
            {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
          </span>
        </div>
        {isRunning && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">Live now</p>
        )}
      </div>

      <div className="shrink-0">
        <StatusChip
          status={fight.status}
          label={tC(`fightStatus.${fight.status}` as Parameters<typeof tC>[0])}
          domain="fight"
        />
      </div>
    </motion.div>
  );
}
