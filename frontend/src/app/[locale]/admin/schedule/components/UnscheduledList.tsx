'use client';

import { useTranslations } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import type { ScheduleFightRow } from '@/types/api';

type Props = {
  fights: ScheduleFightRow[];
  locale: string;
};

export function UnscheduledList({ fights, locale }: Props) {
  const t = useTranslations('schedule');
  if (fights.length === 0) return null;
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-4">
      <p className="mb-2 text-[12px] font-semibold text-[var(--color-text-muted)]">
        {t('unscheduled')} ({fights.length})
      </p>
      <div className="space-y-1">
        {fights.map((fight) => (
          <div key={fight.id} className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px]">
            <span className="font-semibold text-[var(--color-text)]">
              {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)} vs {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
            </span>
            <span className="text-[var(--color-text-muted)]">{fight.bracketRoundLabel} · #{fight.bracketFightNumber}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
