'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import type { PublicEvent } from '@/lib/api/public';

function formatDateRange(start: string, end: string, locale: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function PublicEventFaq({ event }: { event: PublicEvent }) {
  const tPublic = useTranslations('public');
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
              {tPublic('faqGeneralTitle')}
            </h3>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">
              {tPublic('faqGeneralBody', {
                dateRange: formatDateRange(event.competitionStartDate, event.competitionEndDate, locale),
                location: event.location ?? tPublic('faqLocationFallback'),
              })}
            </p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
              {tPublic('faqBracketsTitle')}
            </h3>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">
              {tPublic('faqBracketsBody')}
            </p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
              {tPublic('faqLiveTitle')}
            </h3>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">
              {tPublic('faqLiveBody')}
            </p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
              {tPublic('faqStatusesTitle')}
            </h3>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">
              {tPublic('faqStatusesBody')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
