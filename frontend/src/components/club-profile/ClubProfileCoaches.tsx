'use client';

import { useLocale, useTranslations } from 'next-intl';
import { UserStatusBadge } from '@/components/admin/users/UserStatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { ClubDetailsCoachRow } from '@/types/clubs';
import { formatClubDate } from './clubProfile.utils';

type Props = {
  coaches: ClubDetailsCoachRow[];
};

export function ClubProfileCoaches({ coaches }: Props) {
  const t = useTranslations('clubs.detail');
  const tStatus = useTranslations('clubs.detail.accountStatus');
  const locale = useLocale();

  return (
    <Card className="space-y-5 p-5">
      <div>
        <SectionHeader title={t('coaches.title')} />
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">
          {t('coaches.subtitle')}
        </p>
      </div>

      {coaches.length === 0 ? (
        <EmptyState
          title={t('coaches.emptyTitle')}
          description={t('coaches.emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {coaches.map((coach) => (
            <div
              key={coach.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                    {coach.displayName}
                  </p>
                  <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                    {coach.email}
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                    {t('coaches.columns.created')}: {formatClubDate(coach.createdAt, locale)}
                  </p>
                </div>
                <UserStatusBadge
                  status={coach.status}
                  label={tStatus(coach.status)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
