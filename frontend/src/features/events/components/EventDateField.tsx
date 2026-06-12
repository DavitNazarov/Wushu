'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
const POPOVER_WIDTH = 300;

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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Anchor the floating calendar to the trigger with fixed positioning so it
  // overlays everything — it never grows the modal or adds a scrollbar.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    // Never exceed the viewport — keeps the calendar fully on-screen on mobile.
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
    let left = popoverAlign === 'end' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const popoverHeight = popoverRef.current?.offsetHeight ?? 380;
    let top = rect.bottom + gap;
    if (top + popoverHeight > window.innerHeight - 8 && rect.top - gap - popoverHeight > 8) {
      top = rect.top - gap - popoverHeight;
    }
    top = Math.max(8, top);
    setCoords({ top, left, width });
  }, [popoverAlign]);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

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
        ref={triggerRef}
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

      {mounted && open
        ? createPortal(
            <div
              ref={popoverRef}
              style={{
                position: 'fixed',
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                width: coords?.width ?? POPOVER_WIDTH,
                visibility: coords ? 'visible' : 'hidden',
              }}
              className="z-[60] rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl ring-1 ring-black/5 backdrop-blur dark:ring-white/5"
            >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                {tEvents('datePicker.eyebrow')}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-[var(--color-text)]">
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

          <div className="mb-2 grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_KEYS.map((key) => (
              <span
                key={key}
                className="py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
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
                    'relative flex h-9 items-center justify-center rounded-[10px] text-[13px] font-semibold transition',
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

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickButton onClick={() => quickSet(todayIso)}>{tEvents('datePicker.today')}</QuickButton>
            {value ? (
              <QuickButton onClick={() => onChange('')}>{tEvents('datePicker.clear')}</QuickButton>
            ) : null}
            {min ? <QuickButton onClick={() => quickSet(min)}>{tEvents('datePicker.min')}</QuickButton> : null}
            {max ? <QuickButton onClick={() => quickSet(max)}>{tEvents('datePicker.max')}</QuickButton> : null}
          </div>
            </div>,
            document.body,
          )
        : null}
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
      className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/20 hover:text-[var(--color-text)]"
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
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-text)]"
    >
      {children}
    </button>
  );
}
