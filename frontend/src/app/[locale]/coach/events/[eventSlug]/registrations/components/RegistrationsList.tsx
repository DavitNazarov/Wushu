'use client';

import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/StatusChip';
import type { RegistrationRow } from '@/types/api';
import { athleteInitials, athleteName } from '../registrations.utils';
import { RegistrationsPagination } from './RegistrationsPagination';

type Props = {
  allRows: RegistrationRow[];
  pagedRows: RegistrationRow[];
  locale: string;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onEdit: (reg: RegistrationRow) => void;
};

export function RegistrationsList({ allRows, pagedRows, locale, page, totalPages, onPageChange, onEdit }: Props) {
  const t = useTranslations('coach.registrations');
  const tReg = useTranslations('registrations');

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {t('title')} <span className="ml-1 font-normal normal-case tracking-normal">({allRows.length})</span>
      </h2>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
        {pagedRows.map((reg, i) => (
          <div
            key={reg.id}
            onClick={() => reg.status !== 'WITHDRAWN' && onEdit(reg)}
            className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${
              i !== 0 ? 'border-t border-[var(--color-border)]' : ''
            } bg-[var(--color-surface)] ${reg.status !== 'WITHDRAWN' ? 'cursor-pointer hover:bg-[var(--color-surface-alt)]' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                {athleteInitials(reg)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                  {athleteName(reg, locale)}
                </p>
                {reg.notes && (
                  <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">{reg.notes}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-[12px] text-[var(--color-text-muted)] sm:block">
                {reg.categoryCode}
              </span>
              <StatusChip status={reg.status} label={tReg(`status.${reg.status}`)} domain="registration" />
            </div>
          </div>
        ))}
      </div>

      <RegistrationsPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </section>
  );
}
