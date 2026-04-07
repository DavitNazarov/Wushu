'use client';

import { useLocale, useTranslations } from 'next-intl';

interface DayPickerProps {
  days: string[];
  registrationDays: string[];
  fightDays: string[];
  onRegistrationChange: (days: string[]) => void;
  onFightChange: (days: string[]) => void;
  errors?: string[];
}

function toggle(values: string[], day: string) {
  return values.includes(day) ? values.filter((value) => value !== day) : [...values, day];
}

export function DayPicker({
  days,
  registrationDays,
  fightDays,
  onRegistrationChange,
  onFightChange,
  errors,
}: DayPickerProps) {
  const locale = useLocale();
  const t = useTranslations('admin.events.datesSummary');

  const allReg = days.every((day) => registrationDays.includes(day));
  const allFight = days.every((day) => fightDays.includes(day));
  const overlapCount = days.filter(
    (day) => registrationDays.includes(day) && fightDays.includes(day),
  ).length;

  return (
    <div
      className={`rounded-[22px] border p-4 transition-colors ${
        errors?.length
          ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ring-1 ring-black/5 dark:ring-white/5'
      }`}
    >
      <div className="mb-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {t('eyebrow')}
            </p>
            <h4 className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">
              {t('title')}
            </h4>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[var(--color-text-muted)]">
              {t('helper')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onRegistrationChange(allReg ? [] : [...days])}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                allReg
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]'
              }`}
            >
              {allReg ? t('clearAllRegistration') : t('markAllRegistration')}
            </button>
            <button
              type="button"
              onClick={() => onFightChange(allFight ? [] : [...days])}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                allFight
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:border-amber-500 hover:text-amber-500'
              }`}
            >
              {allFight ? t('clearAllFight') : t('markAllFight')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard label={t('eventDays')} value={days.length} tone="neutral" />
          <SummaryCard label={t('regDays')} value={registrationDays.length} tone="primary" />
          <SummaryCard label={t('fightDays')} value={fightDays.length} tone="warning" />
        </div>

        <div className="flex min-h-[56px] flex-wrap items-center gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/70 px-3 py-3 text-[11px] text-[var(--color-text-muted)]">
          <LegendDot tone="primary" />
          <span>{t('registrationLegend')}</span>
          <LegendDot tone="warning" />
          <span>{t('fightLegend')}</span>
          <span
            className={[
              'rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 font-medium text-[var(--color-text)] transition-opacity',
              overlapCount > 0 ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            aria-hidden={overlapCount === 0}
          >
            {overlapCount > 0 ? t('dualRole', { count: overlapCount }) : '\u00A0'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {days.map((day) => {
          const date = new Date(`${day}T00:00:00`);
          const isReg = registrationDays.includes(day);
          const isFight = fightDays.includes(day);
          const isActive = isReg || isFight;

          return (
            <div
              key={day}
              className={`rounded-[18px] border p-3 transition-all ${
                isActive
                  ? 'border-[var(--color-primary)]/25 bg-[var(--color-surface-alt)] shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    {date.toLocaleDateString(locale, { weekday: 'short' })}
                  </p>
                  <p className="mt-1 text-[20px] font-semibold leading-none text-[var(--color-text)]">
                    {date.getDate()}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {date.toLocaleDateString(locale, { month: 'short' })}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                  {t('dayLabel', { day })}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <StatePill active={isReg} tone="primary" label={t('registrationShort')} />
                <StatePill active={isFight} tone="warning" label={t('fightShort')} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={isReg}
                  onClick={() => onRegistrationChange(toggle(registrationDays, day))}
                  className={`rounded-[12px] border px-2 py-2 text-[11px] font-semibold transition ${
                    isReg
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/35 hover:bg-[var(--color-primary)]/6 hover:text-[var(--color-primary)]'
                  }`}
                >
                  {t('registrationAction')}
                </button>
                <button
                  type="button"
                  aria-pressed={isFight}
                  onClick={() => onFightChange(toggle(fightDays, day))}
                  className={`rounded-[12px] border px-2 py-2 text-[11px] font-semibold transition ${
                    isFight
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  {t('fightAction')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {errors?.map((message, index) => (
        <p key={index} className="mt-2 text-[12px] text-[var(--color-danger)]">
          {message}
        </p>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'primary' | 'warning';
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-[var(--color-primary)]/20 bg-[var(--color-primary)]/8 text-[var(--color-primary)]'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

  return (
    <div className={`rounded-[16px] border px-3 py-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold leading-none">{value}</p>
    </div>
  );
}

function LegendDot({ tone }: { tone: 'primary' | 'warning' }) {
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${
        tone === 'primary' ? 'bg-[var(--color-primary)]' : 'bg-amber-500'
      }`}
    />
  );
}

function StatePill({
  active,
  tone,
  label,
}: {
  active: boolean;
  tone: 'primary' | 'warning';
  label: string;
}) {
  const activeClass =
    tone === 'primary'
      ? 'border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
      : 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400';

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        active
          ? activeClass
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
      }`}
    >
      {label}
    </span>
  );
}
