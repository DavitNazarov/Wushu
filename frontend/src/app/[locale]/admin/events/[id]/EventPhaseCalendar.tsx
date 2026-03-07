'use client';

import { useTranslations } from 'next-intl';
import type { EventRow } from '@/types/api';
import { StatusChip } from '@/components/ui/StatusChip';

interface Props { event: EventRow }

function DayBlock({
  dateStr,
  variant,
  today,
}: {
  dateStr: string;
  variant: 'weighin' | 'fight';
  today: string;
}) {
  const d = new Date(dateStr);
  const isPast = dateStr < today;
  const isToday = dateStr === today;
  const dayNum = d.getDate();
  const month = d.toLocaleString('default', { month: 'short' });

  const base = 'flex flex-col items-center rounded-lg px-2.5 py-2 text-center min-w-[44px] transition-all';
  const cls =
    variant === 'weighin'
      ? isToday
        ? `${base} bg-[var(--color-primary)] text-white ring-2 ring-[var(--color-primary)]/40`
        : isPast
        ? `${base} bg-[var(--color-primary)]/10 text-[var(--color-primary)] opacity-60`
        : `${base} bg-[var(--color-primary)]/15 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30`
      : isToday
      ? `${base} bg-emerald-500 text-white ring-2 ring-emerald-500/40`
      : isPast
      ? `${base} bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] opacity-50`
      : `${base} bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30`;

  return (
    <div className={cls}>
      <span className="text-[9px] font-semibold uppercase opacity-75">{month}</span>
      <span className="text-[16px] font-bold leading-tight tabular-nums">{dayNum}</span>
      <span className="text-[8px] font-semibold uppercase leading-none">
        {isToday ? '●' : isPast && variant === 'weighin' ? '✓' : ''}
        {!isToday && !(isPast && variant === 'weighin') ? '\u00A0' : ''}
      </span>
    </div>
  );
}

export function EventPhaseCalendar({ event }: Props) {
  const tEvents = useTranslations('admin.events');
  const today = new Date().toISOString().slice(0, 10);

  const regDays = [...(event.dates?.registrationDays ?? [])].sort();
  const fightDays = [...(event.dates?.fightDays ?? [])].sort();

  return (
    <div className="space-y-4">
      {/* Stage badge + summary */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          status={event.lifecycle}
          label={tEvents(`lifecycle.${event.lifecycle}` as Parameters<typeof tEvents>[0])}
          domain="lifecycle"
        />
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {regDays.length} {tEvents('phaseBar.weighInDays')} · {fightDays.length} {tEvents('phaseBar.fightDays')}
        </span>
      </div>

      {/* Weigh-in days */}
      {regDays.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {tEvents('phaseBar.weighIn')}
          </p>
          <div className="flex flex-wrap gap-2">
            {regDays.map((day) => (
              <DayBlock key={day} dateStr={day} variant="weighin" today={today} />
            ))}
          </div>
        </div>
      )}

      {/* Fight days */}
      {fightDays.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {tEvents('phaseBar.fights')}
          </p>
          <div className="flex flex-wrap gap-2">
            {fightDays.map((day) => (
              <DayBlock key={day} dateStr={day} variant="fight" today={today} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
