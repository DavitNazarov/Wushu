'use client';

import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import { UserStatusBadge } from '@/components/admin/users/UserStatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ClubDetailsCoachRow } from '@/types/clubs';
import { formatClubDate } from './clubProfile.utils';

type Props = { coaches: ClubDetailsCoachRow[] };

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

export function ClubProfileCoaches({ coaches }: Props) {
  const t = useTranslations('clubs.detail');
  const tStatus = useTranslations('clubs.detail.accountStatus');
  const locale = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{t('coaches.title')}</h3>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('coaches.subtitle')}</p>
          </div>
          {coaches.length > 0 && (
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
              {coaches.length}
            </span>
          )}
        </div>

        {coaches.length === 0 ? (
          <div className="p-5">
            <EmptyState title={t('coaches.emptyTitle')} description={t('coaches.emptyDescription')} />
          </div>
        ) : (
          <motion.div className="divide-y divide-[var(--color-border)]/50" variants={container} initial="hidden" animate="show">
            {coaches.map((coach) => {
              const initials = (coach.displayName ?? coach.email)
                .split(' ')
                .map((n: string) => n.charAt(0))
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <motion.div
                  key={coach.id}
                  variants={item}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-alt)]/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[12px] font-bold uppercase text-[var(--color-primary)]">
                    {initials || <UserRound className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                      {coach.displayName ?? coach.email}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">{coach.email}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      {t('coaches.columns.created')}: {formatClubDate(coach.createdAt, locale)}
                    </p>
                  </div>
                  <UserStatusBadge status={coach.status} label={tStatus(coach.status)} />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
