'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicEvent } from '@/lib/api/public';

function formatDateRange(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} – ${e.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-[var(--color-border)] last:border-b-0`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-[var(--color-surface-alt)]"
      >
        <span className="text-[14px] font-medium text-[var(--color-text)]">{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          {answer}
        </p>
      )}
    </div>
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
    { q: tPublic('faqLiveTitle'), a: tPublic('faqLiveBody') },
    { q: tPublic('faqStatusesTitle'), a: tPublic('faqStatusesBody') },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {items.map(({ q, a }) => (
        <FaqItem key={q} question={q} answer={a} />
      ))}
    </div>
  );
}
