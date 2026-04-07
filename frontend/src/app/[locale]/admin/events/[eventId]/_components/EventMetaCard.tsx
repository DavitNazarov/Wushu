'use client';

import { Globe, Hash, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/primitives/card';
import type { EventRow } from '@/types/api';
import { useTranslations } from 'next-intl';

interface Props {
  event: EventRow;
}

export function EventMetaCard({ event }: Props) {
  const tDetail = useTranslations('admin.events.detail');

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {tDetail('detailsTitle')}
      </h2>
      <div className="space-y-2.5 text-[13px]">
        {event.location ? (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text)]">{event.location}</span>
          </div>
        ) : null}
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span className="text-[var(--color-text)]">{event.timezone}</span>
        </div>
        <div className="flex items-start gap-2">
          <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{event.slug}</span>
        </div>
      </div>
    </Card>
  );
}
