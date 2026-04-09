'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import { UserStatusBadge } from '@/components/admin/users/UserStatusBadge';
import { Card } from '@/components/ui/Card';
import type { ClubDetailsRelatedAccountRow } from '@/types/clubs';

type Props = { relatedAccounts: ClubDetailsRelatedAccountRow[] };

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

export function ClubProfileRelatedAccounts({ relatedAccounts }: Props) {
  const t = useTranslations('clubs.detail');
  const tRole = useTranslations('clubs.detail.roles');
  const tStatus = useTranslations('clubs.detail.accountStatus');

  if (relatedAccounts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{t('relatedAccounts.title')}</h3>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('relatedAccounts.subtitle')}</p>
          </div>
          <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
            {relatedAccounts.length}
          </span>
        </div>

        <motion.div className="divide-y divide-[var(--color-border)]/50" variants={container} initial="hidden" animate="show">
          {relatedAccounts.map((account) => {
            const initials = account.displayName
              .split(' ')
              .map((n: string) => n.charAt(0))
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <motion.div
                key={account.id}
                variants={item}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-alt)]/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] text-[12px] font-bold uppercase text-[var(--color-text-muted)]">
                  {initials || <UserRound className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">{account.displayName}</p>
                  <p className="truncate text-[12px] text-[var(--color-text-muted)]">{account.email}</p>
                  <span className="mt-0.5 inline-block rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {tRole(account.role)}
                  </span>
                </div>
                <UserStatusBadge status={account.status} label={tStatus(account.status)} />
              </motion.div>
            );
          })}
        </motion.div>
      </Card>
    </motion.div>
  );
}
