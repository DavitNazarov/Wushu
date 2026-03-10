'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { BracketViewerPanel } from '@/components/bracket';

type Props = {
  params: Promise<{ slug: string }>;
};

export default function PublicEventBracketsPage({ params }: Props) {
  const { slug } = use(params);
  const tPublic = useTranslations('public');
  const tBracket = useTranslations('brackets');
  const tCommon = useTranslations('common');

  return (
    <PublicLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {tPublic('brackets')}
        </h1>
        <BracketViewerPanel
          eventSlug={slug}
          tBracket={tBracket}
          tCommon={tCommon}
          emptyTitle={tPublic('bracketsNotPublished')}
          emptyDescription={tPublic('notPublishedDescription')}
        />
      </div>
    </PublicLayout>
  );
}
