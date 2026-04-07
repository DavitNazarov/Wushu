'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatDateBadge,
  formatDateMeta,
  parseIsoDate,
  shiftMonth,
  startOfCalendarGrid,
  toIsoDate,
} from '@/features/events/lib/eventDateField';

type Props = {
  label: string;
  value: string;
  min?: string;
  max?: string;
  hint?: string;
  popoverAlign?: 'start' | 'end';
  onChange: (value: string) => void;
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function EventDateField({
  label,
  value,
  min,
  max,
  hint,
  popoverAlign = 'start',
  onChange,
}: Props) {
  const locale = useLocale();
  const tEvents = useTranslations('admin.events');
  const selectedDate = parseIsoDate(value);
  const minDate = parseIsoDate(min ?? '');
  const maxDate = parseIsoDate(max ?? '');
  const today = new Date();
  const todayIso = toIsoDate(today);
  const [open, setOpen] = useState(false);
  const [cursorMonth, setCursorMonth] = useState(() => selectedDate ?? minDate ?? today);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = startOfCalendarGrid(cursorMonth);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursorMonth]);

  function isDisabled(date: Date) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  function selectDate(date: Date) {
    if (isDisabled(date)) return;
    onChange(toIsoDate(date));
    setOpen(false);
  }

  function quickSet(iso: string) {
    const quickDate = parseIsoDate(iso);
    if (!quickDate || isDisabled(quickDate)) return;
    onChange(iso);
    setCursorMonth(quickDate);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">
        {label}
      </label>
      <button
        type="button"
        onClick={() => {
          setCursorMonth(selectedDate ?? minDate ?? today);
          setOpen((current) => !current);
        }}
        className={[
          'group flex h-14 w-full items-center justify-between rounded-[var(--radius-input)] border px-3 text-left transition',
          open
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8 shadow-[0_0_0_3px_rgba(59,130,246,0.14)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]',
        ].join(' ')}
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-[var(--color-text)]">
            {formatDateBadge(value, locale)}
          </span>
          <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
            {value ? formatDateMeta(value, locale) : tEvents('datePicker.emptyMeta')}
          </span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] transition group-hover:text-[var(--color-text)]">
          <CalendarDays className="h-4 w-4" />
        </span>
      </button>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{hint}</p> : null}

      {open ? (
        <div
          className={[
            'absolute top-[calc(100%+0.5rem)] z-30 w-[320px] rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl ring-1 ring-black/5 backdrop-blur dark:ring-white/5',
            popoverAlign === 'end' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                {tEvents('datePicker.eyebrow')}
              </p>
              <p className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">
                {cursorMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <IconButton onClick={() => setCursorMonth((current) => shiftMonth(current, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton onClick={() => setCursorMonth((current) => shiftMonth(current, 1))}>
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_KEYS.map((key) => (
              <span
                key={key}
                className="py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {tEvents(`datePicker.weekdays.${key}`)}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = toIsoDate(day);
              const sameMonth = day.getMonth() === cursorMonth.getMonth();
              const selected = iso === value;
              const isToday = iso === todayIso;
              const disabled = isDisabled(day);

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDate(day)}
                  className={[
                    'relative flex aspect-square items-center justify-center rounded-[14px] text-[13px] font-semibold transition',
                    selected
                      ? 'bg-[linear-gradient(135deg,#2f7df6,#6db6ff)] text-white shadow-[0_10px_22px_rgba(47,125,246,0.35)]'
                      : disabled
                        ? 'cursor-not-allowed text-[var(--color-text-muted)]/35'
                        : sameMonth
                          ? 'text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)]/75',
                    isToday && !selected ? 'ring-1 ring-[var(--color-primary)]/40' : '',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <QuickButton onClick={() => quickSet(todayIso)}>{tEvents('datePicker.today')}</QuickButton>
            {value ? (
              <QuickButton onClick={() => onChange('')}>{tEvents('datePicker.clear')}</QuickButton>
            ) : null}
            {min ? <QuickButton onClick={() => quickSet(min)}>{tEvents('datePicker.min')}</QuickButton> : null}
            {max ? <QuickButton onClick={() => quickSet(max)}>{tEvents('datePicker.max')}</QuickButton> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/20 hover:text-[var(--color-text)]"
    >
      {children}
    </button>
  );
}

function QuickButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-text)]"
    >
      {children}
    </button>
  );
}
