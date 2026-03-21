'use client';

import { useTranslations } from 'next-intl';
import { UserStatusBadge } from '@/components/admin/users/UserStatusBadge';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { ClubDetailsRelatedAccountRow } from '@/types/clubs';

type Props = {
  relatedAccounts: ClubDetailsRelatedAccountRow[];
};

export function ClubProfileRelatedAccounts({ relatedAccounts }: Props) {
  const t = useTranslations('clubs.detail');
  const tRole = useTranslations('clubs.detail.roles');
  const tStatus = useTranslations('clubs.detail.accountStatus');

  if (relatedAccounts.length === 0) return null;

  return (
    <Card className="space-y-5 p-5">
      <div>
        <SectionHeader title={t('relatedAccounts.title')} />
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">
          {t('relatedAccounts.subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        {relatedAccounts.map((account) => (
          <div
            key={account.id}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                  {account.displayName}
                </p>
                <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                  {account.email}
                </p>
                <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                  {t('relatedAccounts.columns.role')}: {tRole(account.role)}
                </p>
              </div>
              <UserStatusBadge
                status={account.status}
                label={tStatus(account.status)}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
