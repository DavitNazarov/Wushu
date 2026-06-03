'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { localizedFullName } from '@/lib/bilingual';
import type { AthleteRow, ClubRow } from '@/types/api';
import { ATHLETES_CARD_CLASS } from '../athletes.types';
import { formatDob, getDuplicateCount, getInitials } from '../athletes.utils';
import { athletesRowContainer, athletesRowItem } from '../athletes.motion';
import { AthleteStatusChip } from './AthleteStatusChip';

type Props = {
  rows: AthleteRow[];
  pageKey: number;
  locale: string;
  onEdit: (a: AthleteRow) => void;
  getClubLabel: (a: AthleteRow) => string;
  getClubMeta: (a: AthleteRow) => string | null;
  getSexLabel: (a: AthleteRow) => string;
};

export function AthletesDesktopTable({ rows, pageKey, locale, onEdit, getClubLabel, getClubMeta, getSexLabel }: Props) {
  const t = useTranslations('athletes');
  return (
    <div className={`${ATHLETES_CARD_CLASS} hidden overflow-hidden lg:block`}>
      <table className="min-w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)]/60 bg-[var(--color-surface-alt)]/40 text-left">
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.name')}</th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.club')}</th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.identity')}</th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.status')}</th>
            <th className="w-10 px-5 py-3" />
          </tr>
        </thead>
        <motion.tbody
          key={pageKey}
          className="divide-y divide-[var(--color-border)]/50"
          variants={athletesRowContainer}
          initial="hidden"
          animate="show"
        >
          {rows.map((athlete) => {
            const duplicateCount = getDuplicateCount(athlete);
            return (
              <motion.tr
                key={athlete.id}
                variants={athletesRowItem}
                className="group bg-[var(--color-surface)] cursor-pointer"
                onClick={() => onEdit(athlete)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)]"
                      whileHover={{ scale: 1.08 }}
                      transition={{ duration: 0.15 }}
                    >
                      {getInitials(athlete)}
                    </motion.div>
                    <div>
                      <p className="font-semibold text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]">
                        {localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale)}
                      </p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{getSexLabel(athlete)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-[var(--color-text)]">{getClubLabel(athlete)}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{getClubMeta(athlete) ?? '—'}</p>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-[var(--color-text)]">{formatDob(athlete.dateOfBirth, locale)}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]/70">{athlete.documentId || '—'}</p>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {duplicateCount > 1 && (
                      <AthleteStatusChip tone="warning" label={t('badges.duplicateCount', { count: duplicateCount })} />
                    )}
                    {!athlete.clubId && <AthleteStatusChip tone="warning" label={t('badges.missingClub')} />}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/${locale}/admin/athletes/${athlete.id}`}>
                    <ChevronRight className="h-4 w-4 text-[var(--color-primary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                </td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}

