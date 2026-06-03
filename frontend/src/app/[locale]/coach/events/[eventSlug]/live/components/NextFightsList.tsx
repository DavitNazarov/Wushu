'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { fighterName } from '../live.utils';
import type { MatFightSlot } from '../live.types';

type Props = { fights: MatFightSlot[]; locale: string };

export function NextFightsList({ fights, locale }: Props) {
  const t = useTranslations('coach.live');
  if (!fights.length) return null;

  return (
    <Card>
      <h3 className="text-[12px] font-semibold uppercase text-[var(--color-text-muted)]">{t('next')}</h3>
      <ul className="mt-2 space-y-1 text-[14px]">
        {fights.map((f) => (
          <li key={f.id}>
            {fighterName(f.redAthlete, locale)} vs {fighterName(f.blueAthlete, locale)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
