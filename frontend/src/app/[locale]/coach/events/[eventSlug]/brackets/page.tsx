'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';
import { BracketViewerPanel } from '@/components/bracket';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

export default function CoachBracketsPage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const tCoach = useTranslations('coach.brackets');
  const tBracket = useTranslations('brackets');
  const tCommon = useTranslations('common');

  const { data: event } = useQuery({
    queryKey: ['public', 'event', eventSlug],
    queryFn: () => apiGet<EventRow>(`/api/public/events/${eventSlug}`),
    enabled: Boolean(eventSlug),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={event?.name ?? eventSlug}
        subtitle={tCoach('title')}
        actions={
          <Link
            href={`/${locale}/coach/events`}
            className="text-[13px] text-[var(--color-text-muted)] hover:underline"
          >
            ← {tCommon('back')}
          </Link>
        }
      />

      <BracketViewerPanel
        eventSlug={eventSlug}
        tBracket={tBracket}
        tCommon={tCommon}
        emptyTitle={tCoach('emptyTitle')}
        emptyDescription={tCoach('emptyDescription')}
      />
    </div>
  );
}
