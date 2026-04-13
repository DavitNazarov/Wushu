'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import type { PublicEvent } from '@/lib/api/public';

function formatDateRange(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} – ${e.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function FaqItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className="border-b border-[var(--color-border)] last:border-b-0"
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{
        delay: index * 0.07,
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-[var(--color-surface-alt)]"
      >
        <span className="text-[14px] font-medium text-[var(--color-text)]">{question}</span>

        {/* Animated chevron — animate-ui style spring rotation */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{ display: 'inline-flex', flexShrink: 0 }}
        >
          <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
        </motion.span>
      </button>

      {/* Animated answer — animate-ui accordion height + blur reveal */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0, filter: 'blur(4px)' }}
            animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)' }}
            exit={{ height: 0, opacity: 0, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 160, damping: 26 }}
            style={{ overflow: 'hidden' }}
          >
            <p className="px-4 pb-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PublicEventFaq({ event }: { event: PublicEvent }) {
  const tPublic = useTranslations('public');
  const locale = useLocale();

  const items = [
    {
      q: tPublic('faqGeneralTitle'),
      a: tPublic('faqGeneralBody', {
        dateRange: formatDateRange(event.competitionStartDate, event.competitionEndDate, locale),
        location: event.location ?? tPublic('faqLocationFallback'),
      }),
    },
    { q: tPublic('faqBracketsTitle'), a: tPublic('faqBracketsBody') },
    { q: tPublic('faqLiveTitle'),     a: tPublic('faqLiveBody') },
    { q: tPublic('faqStatusesTitle'), a: tPublic('faqStatusesBody') },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {items.map(({ q, a }, i) => (
        <FaqItem key={q} question={q} answer={a} index={i} />
      ))}
    </div>
  );
}
