'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { StatusChip } from '@/components/ui/StatusChip';
import { adminVariants } from '@/lib/animations/variants';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';
import { daysUntil, formatDate } from '../../dashboard.utils';

type Props = {
  ev: EventRow;
  locale: string;
  tEvents: (k: string) => string;
};

export function EventListRow({ ev, locale, tEvents }: Props) {
  const days = daysUntil(ev.competitionStartDate);
  return (
    <motion.div
      variants={adminVariants.staggerChild}
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-3 transition-colors first:border-t-0 hover:bg-[var(--color-surface-alt)]"
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/${locale}/admin/events`}
          className="text-[13px] font-medium text-[var(--color-text)] hover:underline"
        >
          {localizedName(ev.name, ev.nameKa, locale)}
        </Link>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {ev.location ? `${ev.location} · ` : ''}
          {formatDate(ev.competitionStartDate)}
          {days > 0 && days < 30 && (
            <span className="ml-2 font-semibold text-[var(--color-primary)]">in {days}d</span>
          )}
        </p>
      </div>
      <StatusChip
        status={ev.lifecycle}
        label={tEvents(`lifecycle.${ev.lifecycle}`)}
        domain="lifecycle"
      />
    </motion.div>
  );
}
