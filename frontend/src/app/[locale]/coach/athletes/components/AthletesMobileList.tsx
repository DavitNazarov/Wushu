'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { localizedFullName } from '@/lib/bilingual';
import type { AthleteRow } from '@/types/api';
import { AthleteAvatar } from './AthleteAvatar';
import { formatDob, getInitials } from '../athletes.utils';

type Props = {
  rows: AthleteRow[];
  locale: string;
  onEdit: (a: AthleteRow) => void;
};

export function AthletesMobileList({ rows, locale, onEdit }: Props) {
  const tProfile = useTranslations('athleteProfile.identity');

  return (
    <div className="space-y-3 sm:hidden">
      {rows.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onEdit(a)}
          className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]/40"
        >
          <div className="flex items-center gap-3">
            <AthleteAvatar initials={getInitials(a)} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                {localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {formatDob(a.dateOfBirth, locale)}{a.sex ? ` · ${tProfile(`sexValue.${a.sex}`)}` : ''}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </div>
        </button>
      ))}
    </div>
  );
}
