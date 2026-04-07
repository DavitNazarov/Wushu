'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import type { EventRow } from '@/types/api';

type Props = {
  currentEventId: string;
  events: EventRow[];
  isConnected: boolean;
  lastSyncLabel: string;
  onEventChange: (value: string) => void;
};

export function LiveControlHeader({
  currentEventId,
  events,
  isConnected,
  lastSyncLabel,
  onEventChange,
}: Props) {
  const t = useTranslations('live');

  return (
    <PageHeader
      title={t('title')}
      subtitle={t('controlRoom')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {events.length > 0 ? (
            <Select value={currentEventId} onValueChange={onEventChange}>
              <SelectTrigger
                aria-label={t('eventSelectorLabel')}
                className="h-10 min-w-[220px] bg-[var(--color-surface)] px-3 py-2 text-[13px] shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[14px] bg-[var(--color-surface)] text-[13px] shadow-xl">
                {events.map((event) => (
                  <SelectItem
                    key={event.id}
                    value={event.id}
                    className="rounded-[10px] py-2 text-[13px]"
                  >
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
            <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>● </span>
            {t('realtime')}: {isConnected ? t('connected') : t('disconnected')} · {t('lastSync')}:{' '}
            {lastSyncLabel}
          </div>
        </div>
      }
    />
  );
}
