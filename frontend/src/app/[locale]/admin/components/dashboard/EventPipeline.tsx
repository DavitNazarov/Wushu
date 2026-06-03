'use client';

import { motion } from 'framer-motion';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';
import { PIPELINE_STAGES } from '../../dashboard.utils';

type Props = {
  events: EventRow[];
  locale: string;
  tEvents: (k: string) => string;
};

export function EventPipeline({ events, locale, tEvents }: Props) {
  const byStage = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    events: events.filter((e) => e.lifecycle === stage.key),
  })).filter((s) => s.events.length > 0);

  if (!byStage.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {byStage.map((stage, i) => (
        <motion.div
          key={stage.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="min-w-[160px] flex-shrink-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: stage.color }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: stage.color }}>
              {tEvents(`lifecycle.${stage.key}`)}
            </span>
          </div>
          <div className="space-y-1">
            {stage.events.map((ev) => (
              <p key={ev.id} className="truncate text-[12px] font-medium text-[var(--color-text)]">
                {localizedName(ev.name, ev.nameKa, locale)}
              </p>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
