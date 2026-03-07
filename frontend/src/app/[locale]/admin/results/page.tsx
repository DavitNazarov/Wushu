'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api/client';
import type { EventRow, FightRow } from '@/types/api';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type ResultFight = FightRow & {
  categoryLabel?: string;
  winnerName?: string;
};

function athleteName(a?: { firstName: string; lastName: string } | null) {
  return a ? `${a.firstName} ${a.lastName}` : 'BYE';
}

export default function ResultsPage() {
  const t = useTranslations('results');
  const tCommon = useTranslations('common');
  const [eventId, setEventId] = useState('');

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });
  const eid = eventId || events?.[0]?.id || '';

  const { data: fights, isLoading, error, refetch } = useQuery({
    queryKey: ['results', eid],
    queryFn: () => apiGet<ResultFight[]>(`/api/results?eventId=${eid}`),
    enabled: !!eid,
  });

  function winnerLabel(f: ResultFight) {
    if (f.winnerName) return f.winnerName;
    if (!f.winnerAthleteId) return '—';
    if (f.winnerAthleteId === f.redAthlete?.id) return athleteName(f.redAthlete);
    if (f.winnerAthleteId === f.blueAthlete?.id) return athleteName(f.blueAthlete);
    return '—';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <select className={SEL} value={eid} onChange={(e) => setEventId(e.target.value)}>
            {events?.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        }
      />

      {error && (
        <InlineAlert
          variant="error"
          actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">
              {tCommon('retry')}
            </button>
          }
        >
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <SkeletonRows rows={5} cols={5} />
      ) : !fights?.length ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.category')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.round')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.red')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.blue')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.winner')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.method')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {fights.map((f) => (
                  <tr key={f.id} className="bg-[var(--color-surface)]">
                    <td className="px-4 py-3 text-[var(--color-text)]">{f.categoryLabel ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">R{f.round}</td>
                    <td className="px-4 py-3 text-red-400">{athleteName(f.redAthlete)}</td>
                    <td className="px-4 py-3 text-blue-400">{athleteName(f.blueAthlete)}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--color-success)]">{winnerLabel(f)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{f.winMethod ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="space-y-2 sm:hidden">
            {fights.map((f) => (
              <div
                key={f.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    {f.categoryLabel ?? '—'} · R{f.round}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-muted)]">{f.winMethod ?? '—'}</span>
                </div>
                <div className="mt-2 text-[13px]">
                  <span className="font-medium text-red-400">{athleteName(f.redAthlete)}</span>
                  <span className="mx-1 text-[var(--color-text-muted)]">vs</span>
                  <span className="font-medium text-blue-400">{athleteName(f.blueAthlete)}</span>
                </div>
                <p className="mt-1 text-[12px] font-semibold text-[var(--color-success)]">
                  {winnerLabel(f)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
