'use client';

import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import type { ScheduleFightRow as Fight } from '@/types/api';
import { ScheduleFightRow } from './ScheduleFightRow';

type Props = {
  matName: string;
  matIdx: number;
  fights: Fight[];
  locale: string;
};

export function ScheduleMatGroup({ matName, matIdx, fights, locale }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: matIdx * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {matName}
          </h3>
        </div>
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-[12px] text-[var(--color-text-muted)]">{fights.length} fights</span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {fights.map((f, idx) => (
          <ScheduleFightRow
            key={f.id}
            fight={f}
            idx={idx}
            lastIdx={fights.length - 1}
            locale={locale}
          />
        ))}
      </div>
    </motion.div>
  );
}
