'use client';

import Link from 'next/link';
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

export function AthletesDesktopTable({ rows, locale, onEdit }: Props) {
  const t = useTranslations('coach.athletes');
  const tAth = useTranslations('athletes');
  const tProfile = useTranslations('athleteProfile.identity');

  return (
    <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
      <table className="w-full text-left text-[14px]">
        <thead className="bg-[var(--color-surface-alt)]">
          <tr>
            <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.name')}</th>
            <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.dob')}</th>
            <th className="hidden px-4 py-3 font-medium text-[var(--color-text-muted)] md:table-cell">{tAth('columns.document')}</th>
            <th className="hidden px-4 py-3 font-medium text-[var(--color-text-muted)] lg:table-cell">{tAth('columns.sex')}</th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              onClick={() => onEdit(a)}
              className="cursor-pointer border-t border-[var(--color-border)] bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <AthleteAvatar initials={getInitials(a)} size="sm" />
                  <span className="font-medium text-[var(--color-text)]">
                    {localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDob(a.dateOfBirth, locale)}</td>
              <td className="hidden px-4 py-3 text-[var(--color-text-muted)] md:table-cell">{a.documentId || '—'}</td>
              <td className="hidden px-4 py-3 text-[var(--color-text-muted)] lg:table-cell">
                {a.sex ? tProfile(`sexValue.${a.sex}`) : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/${locale}/coach/athletes/${a.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  aria-label={t('viewProfile')}
                >
                  {t('viewProfile')} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
