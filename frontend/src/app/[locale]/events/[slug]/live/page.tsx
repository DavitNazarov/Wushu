'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PublicLivePanel } from '@/components/event/PublicLivePanel';

type Props = { params: Promise<{ slug: string }> };

export default function PublicEventLivePage({ params }: Props) {
  const { slug } = use(params);
  const tPublic = useTranslations('public');

  return (
    <PublicLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{tPublic('live')}</h1>
        <PublicLivePanel eventSlug={slug} />
      </div>
    </PublicLayout>
  );
}
