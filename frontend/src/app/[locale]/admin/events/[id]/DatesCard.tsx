'use client';

import { useTranslations } from 'next-intl';
import type { EventRow } from '@/types/api';

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function fmtRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return '—';
  const s = fmt(start);
  const e = fmt(end);
  if (s === e) return s;
  return `${s} – ${e}`;
}

interface Props { event: EventRow }

export function DatesCard({ event }: Props) {
  const tDetail = useTranslations('admin.events.detail');
  const { dates } = event;

  const regSet = new Set(dates?.registrationDays ?? []);
  const fightSet = new Set(dates?.fightDays ?? []);

  const allDays: string[] = [];
  if (dates?.range.startDate && dates?.range.endDate) {
    const cursor = new Date(dates.range.startDate);
    const end = new Date(dates.range.endDate);
    while (cursor <= end) {
      allDays.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const showCalendar = allDays.length >= 1 && allDays.length <= 21;

  const rows = [
    {
      label: tDetail('dateOnlineReg'),
      start: event.registrationOpensAt,
      end: event.registrationClosesAt,
      border: 'border-l-[var(--color-primary)]',
      pill: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    },
    {
      label: tDetail('dateWeighIn'),
      start: event.weighInStartDate,
      end: event.weighInEndDate,
      border: 'border-l-amber-500',
      pill: 'bg-amber-500/10 text-amber-400',
    },
    {
      label: tDetail('dateCompetition'),
      start: event.competitionStartDate,
      end: event.competitionEndDate,
      border: 'border-l-emerald-500',
      pill: 'bg-emerald-500/10 text-emerald-400',
    },
  ] as const;

  return (
    <div>
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {tDetail('datesTitle')}
      </h2>

      {/* Mini day calendar */}
      {showCalendar && (
        <div className="mb-5">
          <div className="flex flex-wrap gap-1.5">
            {allDays.map((day) => {
              const isReg = regSet.has(day);
              const isFight = fightSet.has(day);
              const d = new Date(day);
              return (
                <div
                  key={day}
                  title={isFight ? tDetail('legendFight') : isReg ? tDetail('legendWeighin') : day}
                  className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-center ${
                    isFight
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-500/25'
                      : isReg
                      ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/25'
                      : 'bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <span className={`text-[9px] font-semibold uppercase ${
                    isFight ? 'text-emerald-400' : isReg ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    {d.toLocaleString('default', { month: 'short' })}
                  </span>
                  <span className={`text-[14px] font-bold leading-tight tabular-nums ${
                    isFight ? 'text-emerald-300' : isReg ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 flex gap-4 text-[11px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-[var(--color-primary)]/25 ring-1 ring-[var(--color-primary)]/25" />
              {tDetail('legendWeighin')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-emerald-500/25 ring-1 ring-emerald-500/25" />
              {tDetail('legendFight')}
            </span>
          </div>
        </div>
      )}

      {/* Rows with left accent border */}
      <div className="space-y-2">
        {rows.map(({ label, start, end, border, pill }) => (
          <div
            key={label}
            className={`flex items-center justify-between rounded-r-lg border-l-2 ${border} bg-[var(--color-surface-alt)] px-3 py-2.5`}
          >
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${pill}`}>
              {label}
            </span>
            <span className="ml-3 text-right text-[13px] font-medium tabular-nums text-[var(--color-text)]">
              {fmtRange(start, end)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
