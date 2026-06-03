'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { localizedFullName } from '@/lib/bilingual';
import type { AthleteRow } from '@/types/api';
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
  getSexLabel: (a: AthleteRow) => string;
};

export function AthletesMobileList({ rows, pageKey, locale, onEdit, getClubLabel, getSexLabel }: Props) {
  const t = useTranslations('athletes');
  return (
    <motion.div
      key={`mobile-${pageKey}`}
      className="space-y-2 lg:hidden"
      variants={athletesRowContainer}
      initial="hidden"
      animate="show"
    >
      {rows.map((athlete) => {
        const duplicateCount = getDuplicateCount(athlete);
        return (
          <motion.div
            key={athlete.id}
            variants={athletesRowItem}
            whileHover={{ y: -2, boxShadow: '0 6px 20px -6px rgba(0,0,0,0.18)' }}
            transition={{ duration: 0.15 }}
          >
            <button
              type="button"
              onClick={() => onEdit(athlete)}
              className={`${ATHLETES_CARD_CLASS} group flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--color-surface-alt)]/30`}
            >
              <motion.div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)]"
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.15 }}
              >
                {getInitials(athlete)}
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                  {localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale)}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{getClubLabel(athlete)} · {getSexLabel(athlete)}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{formatDob(athlete.dateOfBirth, locale)}</p>
                {(duplicateCount > 1 || !athlete.clubId) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {duplicateCount > 1 && <AthleteStatusChip tone="warning" label={t('badges.duplicateCount', { count: duplicateCount })} />}
                    {!athlete.clubId && <AthleteStatusChip tone="warning" label={t('badges.missingClub')} />}
                  </div>
                )}
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
