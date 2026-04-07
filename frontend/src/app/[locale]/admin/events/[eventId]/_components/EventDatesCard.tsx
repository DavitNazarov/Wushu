'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/primitives/card';
import { parseIsoDate } from '@/features/events/lib/eventDateField';
import type { EventRow } from '@/types/api';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (ISO_DATE_RE.test(value)) return parseIsoDate(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string | null | undefined, locale: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat(locale).format(parsed);
}

function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: string,
) {
  if (!start && !end) return '—';
  const startLabel = formatDate(start, locale);
  const endLabel = formatDate(end, locale);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

interface Props {
  event: EventRow;
}

export function EventDatesCard({ event }: Props) {
  const locale = useLocale();
  const tDetail = useTranslations('admin.events.detail');
  const { dates } = event;

  const registrationDays = new Set(dates?.registrationDays ?? []);
  const fightDays = new Set(dates?.fightDays ?? []);

  const allDays: string[] = [];
  const startDate = parseIsoDate(dates?.range.startDate ?? '');
  const endDate = parseIsoDate(dates?.range.endDate ?? '');
  if (startDate && endDate) {
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const year = cursor.getFullYear();
      const month = `${cursor.getMonth() + 1}`.padStart(2, '0');
      const day = `${cursor.getDate()}`.padStart(2, '0');
      allDays.push(`${year}-${month}-${day}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const showCalendar = allDays.length >= 1 && allDays.length <= 21;
  const rows = [
    {
      label: tDetail('dateOnlineReg'),
      start: event.registrationOpensAt,
      end: event.registrationClosesAt,
      borderClassName: 'border-l-[var(--color-primary)]',
      pillClassName: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    },
    {
      label: tDetail('dateWeighIn'),
      start: event.weighInStartDate,
      end: event.weighInEndDate,
      borderClassName: 'border-l-amber-500',
      pillClassName: 'bg-amber-500/10 text-amber-400',
    },
    {
      label: tDetail('dateCompetition'),
      start: event.competitionStartDate,
      end: event.competitionEndDate,
      borderClassName: 'border-l-emerald-500',
      pillClassName: 'bg-emerald-500/10 text-emerald-400',
    },
  ] as const;

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {tDetail('datesTitle')}
      </h2>

      {showCalendar ? (
        <div className="mb-5">
          <div className="flex flex-wrap gap-1.5">
            {allDays.map((day) => {
              const isRegistrationDay = registrationDays.has(day);
              const isFightDay = fightDays.has(day);
              const parsedDay = parseIsoDate(day);
              if (!parsedDay) return null;
              const title = isFightDay
                ? tDetail('legendFight')
                : isRegistrationDay
                  ? tDetail('legendWeighin')
                  : formatDate(day, locale);

              return (
                <div
                  key={day}
                  title={title}
                  className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-center ${
                    isFightDay
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-500/25'
                      : isRegistrationDay
                        ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/25'
                        : 'bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <span
                    className={`text-[9px] font-semibold uppercase ${
                      isFightDay
                        ? 'text-emerald-400'
                        : isRegistrationDay
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {new Intl.DateTimeFormat(locale, { month: 'short' }).format(parsedDay)}
                  </span>
                  <span
                    className={`text-[14px] font-bold leading-tight tabular-nums ${
                      isFightDay
                        ? 'text-emerald-300'
                        : isRegistrationDay
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {parsedDay.getDate()}
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
      ) : null}

      <div className="space-y-2">
        {rows.map(({ label, start, end, borderClassName, pillClassName }) => (
          <div
            key={label}
            className={`flex items-center justify-between rounded-r-lg border-l-2 ${borderClassName} bg-[var(--color-surface-alt)] px-3 py-2.5`}
          >
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${pillClassName}`}>
              {label}
            </span>
            <span className="ml-3 text-right text-[13px] font-medium tabular-nums text-[var(--color-text)]">
              {formatDateRange(start, end, locale)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
