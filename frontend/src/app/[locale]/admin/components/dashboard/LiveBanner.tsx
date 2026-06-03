'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Radio } from 'lucide-react';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';

type Props = {
  events: EventRow[];
  locale: string;
  t: (k: string) => string;
};

export function LiveBanner({ events, locale, t }: Props) {
  if (!events.length) return null;
  const ev = events[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)]/40 bg-[var(--color-success)]/8 px-4 py-3"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-success)]" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold text-[var(--color-success)]">{t('liveNow')}: </span>
        <span className="text-[13px] font-medium text-[var(--color-text)]">{localizedName(ev.name, ev.nameKa, locale)}</span>
        {ev.location && (
          <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">
            <MapPin className="mb-0.5 mr-0.5 inline h-3 w-3" />
            {ev.location}
          </span>
        )}
      </div>
      <Link
        href={`/${locale}/admin/events/${ev.id}/live`}
        className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
      >
        <Radio className="h-3 w-3" />
        {t('liveGoTo')}
      </Link>
    </motion.div>
  );
}
