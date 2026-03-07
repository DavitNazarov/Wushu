'use client';

import { useTranslations } from 'next-intl';

interface DayPickerProps {
  days: string[];
  registrationDays: string[];
  fightDays: string[];
  onRegistrationChange: (days: string[]) => void;
  onFightChange: (days: string[]) => void;
  errors?: string[];
}

function toggle(arr: string[], day: string) {
  return arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day];
}

export function DayPicker({
  days,
  registrationDays,
  fightDays,
  onRegistrationChange,
  onFightChange,
  errors,
}: DayPickerProps) {
  const t = useTranslations('admin.events.datesSummary');

  const allReg = days.every((d) => registrationDays.includes(d));
  const allFight = days.every((d) => fightDays.includes(d));

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        errors?.length ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
      }`}
    >
      {/* Summary + Quick-select row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
            {days.length} {t('eventDays').toLowerCase()}
          </span>
          <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
            {registrationDays.length} {t('registrationShort')}
          </span>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-500">
            {fightDays.length} {t('fightShort')}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onRegistrationChange(allReg ? [] : [...days])}
            className={`rounded-lg border px-3 py-1 text-[11px] font-semibold transition ${
              allReg
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            }`}
          >
            All R
          </button>
          <button
            type="button"
            onClick={() => onFightChange(allFight ? [] : [...days])}
            className={`rounded-lg border px-3 py-1 text-[11px] font-semibold transition ${
              allFight
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-500 hover:text-amber-500'
            }`}
          >
            All F
          </button>
        </div>
      </div>

      {/* Day cards */}
      <div className="flex flex-wrap gap-2">
        {days.map((day) => {
          const d = new Date(day + 'T00:00:00');
          const isReg = registrationDays.includes(day);
          const isFight = fightDays.includes(day);
          const isActive = isReg || isFight;
          return (
            <div
              key={day}
              className={`flex w-14 flex-col items-center rounded-xl border p-1.5 transition-all ${
                isActive
                  ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]'
              }`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {d.toLocaleDateString('en', { weekday: 'short' })}
              </span>
              <span className="my-0.5 text-[17px] font-bold leading-none text-[var(--color-text)]">
                {d.getDate()}
              </span>
              <span className="mb-2 text-[9px] text-[var(--color-text-muted)]">
                {d.toLocaleDateString('en', { month: 'short' })}
              </span>
              <div className="flex w-full gap-0.5">
                <button
                  type="button"
                  title={t('registrationShort')}
                  onClick={() => onRegistrationChange(toggle(registrationDays, day))}
                  className={`flex-1 rounded-md py-0.5 text-[9px] font-bold transition ${
                    isReg
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)]'
                  }`}
                >
                  R
                </button>
                <button
                  type="button"
                  title={t('fightShort')}
                  onClick={() => onFightChange(toggle(fightDays, day))}
                  className={`flex-1 rounded-md py-0.5 text-[9px] font-bold transition ${
                    isFight
                      ? 'bg-amber-500 text-white'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:bg-amber-500/20 hover:text-amber-500'
                  }`}
                >
                  F
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {errors?.map((msg, i) => (
        <p key={i} className="mt-2 text-[12px] text-[var(--color-danger)]">
          {msg}
        </p>
      ))}
    </div>
  );
}
