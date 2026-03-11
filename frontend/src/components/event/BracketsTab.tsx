'use client';

import { useLocale, useTranslations } from 'next-intl';
import { BracketViewerPanel } from '@/components/bracket';

export function BracketsTab({ eventSlug }: { eventSlug: string }) {
  const tPublic = useTranslations('public');
  const tBracket = useTranslations('brackets');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <BracketViewerPanel
      eventSlug={eventSlug}
      tBracket={tBracket}
      tCommon={tCommon}
      emptyTitle={tPublic('bracketsNotPublished')}
      emptyDescription={tPublic('notPublishedDescription')}
      getAthleteHref={(athleteId) => `/${locale}/athletes/${athleteId}`}
    />
  );
}
