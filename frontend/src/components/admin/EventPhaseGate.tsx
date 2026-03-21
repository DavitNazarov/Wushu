'use client';

import { StatusChip } from '@/components/ui/StatusChip';
import type { EventControlGateState } from '@/domain/events/controlPageGate';

type TranslationFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

type Props = {
  gate: EventControlGateState;
  locale: string;
  t: TranslationFn;
  tEvents: TranslationFn;
};

const MODE_TONE_CLASS: Record<'upcoming' | 'locked' | 'readonly', string> = {
  upcoming: 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10',
  locked: 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10',
  readonly: 'border-[var(--color-border)] bg-[var(--color-surface-alt)]',
};

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EventPhaseGate({ gate, locale, t, tEvents }: Props) {
  if (!gate.event || gate.mode === 'active' || gate.mode === 'unselected') return null;

  const formattedDate = formatDate(gate.dateIso, locale);
  const descriptionKey = `pages.${gate.page}.${gate.mode}${formattedDate ? 'WithDate' : 'WithoutDate'}`;

  return (
    <section
      className={`rounded-[var(--radius-card)] border p-4 ${MODE_TONE_CLASS[gate.mode]}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <StatusChip
            status={gate.mode}
            label={t(`status.${gate.mode}`)}
          />
          <p className="text-sm font-medium text-[var(--color-text)]">
            {t(descriptionKey, formattedDate ? { date: formattedDate } : undefined)}
          </p>
        </div>

        <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text)]">{t('currentPhaseLabel')}:</span>{' '}
          {tEvents(`lifecycle.${gate.event.lifecycle}`)}
        </div>
      </div>
    </section>
  );
}
