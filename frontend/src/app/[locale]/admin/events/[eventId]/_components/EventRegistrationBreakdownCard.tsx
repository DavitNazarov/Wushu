'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/primitives/card';
import { StatusChip } from '@/components/ui/StatusChip';

const REGISTRATION_STATUSES = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;

interface Props {
  byStatus: Record<string, number>;
}

export function EventRegistrationBreakdownCard({ byStatus }: Props) {
  const tDetail = useTranslations('admin.events.detail');
  const tRegistrations = useTranslations('registrations');

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {tDetail('regBreakdownTitle')}
      </h2>
      <div className="flex flex-wrap gap-3">
        {REGISTRATION_STATUSES.map((status) => {
          const count = byStatus[status] ?? 0;
          if (!count) return null;

          return (
            <div key={status} className="flex items-center gap-2">
              <StatusChip
                status={status}
                label={tRegistrations(`status.${status}`)}
                domain="registration"
              />
              <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
