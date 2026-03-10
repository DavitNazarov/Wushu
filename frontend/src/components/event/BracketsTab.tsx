'use client';

import { useTranslations } from 'next-intl';
import { BracketViewerPanel } from '@/components/bracket';

export function BracketsTab({ eventSlug }: { eventSlug: string }) {
  const tPublic = useTranslations('public');
  const tBracket = useTranslations('brackets');
  const tCommon = useTranslations('common');

  return (
    <BracketViewerPanel
      eventSlug={eventSlug}
      tBracket={tBracket}
      tCommon={tCommon}
      emptyTitle={tPublic('bracketsNotPublished')}
      emptyDescription={tPublic('notPublishedDescription')}
    />
  );
}
