'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { fighterName } from '../live.utils';
import type { MatFightSlot } from '../live.types';

type Props = { fight: MatFightSlot | null; locale: string };

export function NowFightCard({ fight, locale }: Props) {
  const t = useTranslations('coach.live');

  if (!fight) {
    return (
      <Card>
        <h3 className="text-[12px] font-semibold uppercase text-[var(--color-text-muted)]">{t('now')}</h3>
        <p className="mt-2 text-[15px] text-[var(--color-text-muted)]">—</p>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">{t('now')}</h3>
      <p className="mt-2 text-[18px] font-semibold">
        {fighterName(fight.redAthlete, locale)} vs {fighterName(fight.blueAthlete, locale)}
      </p>
    </Card>
  );
}
