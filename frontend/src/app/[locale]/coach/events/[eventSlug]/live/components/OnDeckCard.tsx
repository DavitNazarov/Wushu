'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { fighterName } from '../live.utils';
import type { MatFightSlot } from '../live.types';

type Props = { fight: MatFightSlot | null; locale: string };

export function OnDeckCard({ fight, locale }: Props) {
  const t = useTranslations('coach.live');
  if (!fight) return null;

  return (
    <Card>
      <h3 className="text-[12px] font-semibold uppercase text-[var(--color-text-muted)]">{t('onDeck')}</h3>
      <p className="mt-2 text-[15px]">
        {fighterName(fight.redAthlete, locale)} vs {fighterName(fight.blueAthlete, locale)}
      </p>
    </Card>
  );
}
