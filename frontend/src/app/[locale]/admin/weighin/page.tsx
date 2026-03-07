'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import type { EventRow, WeighInDecision } from '@/types/api';
import { WeighinForm } from './WeighinForm';

const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

const D_CLR: Record<string, string> = {
  PASS: 'text-[var(--color-success)]',
  REWEIGH: 'text-[var(--color-warning)]',
  FAIL: 'text-[var(--color-danger)]',
  ONE_HOUR: 'text-amber-400',
};

type WEntry = {
  id: string; attemptNo: number; weightKg: number; decision: string;
  deadlineAt?: string | null; resolvedAt?: string | null; resolvedAction?: string | null;
};
type WCatInfo = {
  id: string;
  rulesetWeightCategory: { name: string; minWeightKgExcl: number | null; maxWeightKgIncl: number | null };
  eventAgeGroup: {
    weightCategories: Array<{ id: string; rulesetWeightCategory: { sortOrder: number; name: string; maxWeightKgIncl: number | null } }>;
  };
} | null;
type WReg = {
  id: string; categoryLabel: string | null;
  athlete: { id: string; firstName: string; lastName: string; documentId: string | null };
  club: { name: string } | null; weighIns: WEntry[];
  eventWeightCategory: WCatInfo;
};

export default function WeighinPage() {
  const t = useTranslations('weighin');
  const tC = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedEventId, setSelectedEventId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });
  const eventId = selectedEventId || events?.[0]?.id || '';

  const { data: regs, isLoading, error, refetch } = useQuery({
    queryKey: ['weighin', eventId, search],
    queryFn: () => {
      const p = new URLSearchParams({ eventId });
      if (search) p.set('q', search);
      return apiGet<WReg[]>(`/api/weighin?${p}`);
    },
    enabled: !!eventId,
  });

  const selected = regs?.find((r) => r.id === selectedId) ?? null;

  const recordMut = useMutation({
    mutationFn: (body: object) => apiPost('/api/weighin', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weighin', eventId] });
      toast(t('recorded'));
    },
    onError: () => toast(tC('error'), 'error'),
  });

  const resolveMut = useMutation({
    mutationFn: (body: { id: string; action: 'MOVE_UP' | 'DQ'; nextEventWeightCategoryId?: string }) =>
      apiPost(`/api/weighin/${body.id}/resolve`, { action: body.action, nextEventWeightCategoryId: body.nextEventWeightCategoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weighin', eventId] });
      toast(t('resolved'));
    },
    onError: () => toast(tC('error'), 'error'),
  });

  function handleRecord(weight: string, decision: WeighInDecision, override: boolean, overrideReason: string) {
    if (!selectedId || !weight) return;
    const body: Record<string, unknown> = {
      registrationId: selectedId, weightKg: parseFloat(weight), decision,
    };
    if (override) { body.override = true; body.reason = overrideReason; }
    recordMut.mutate(body);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} actions={
        <select className={SEL} value={eventId}
          onChange={(e) => { setSelectedEventId(e.target.value); setSelectedId(null); }}>
          {events?.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      } />

      {error && (
        <InlineAlert variant="error"
          actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tC('retry')}</button>}>
          {tC('loadError')}
        </InlineAlert>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: searchable athlete list */}
        <div className="min-w-0 flex-1">
          <input className={INPUT} placeholder={t('searchPlaceholder')} value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-4">
            {isLoading ? (
              <SkeletonRows rows={4} cols={2} />
            ) : !regs?.length ? (
              <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
            ) : (
              <div className="space-y-2">
                {regs.map((reg) => {
                  const last = reg.weighIns[reg.weighIns.length - 1];
                  return (
                    <button key={reg.id} type="button"
                      onClick={() => setSelectedId(reg.id)}
                      className={`w-full rounded-[var(--radius-card)] border p-4 text-left transition ${
                        selectedId === reg.id
                          ? 'border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/20 bg-[var(--color-surface-alt)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)]'
                      }`}
                    >
                      <p className="text-[13px] font-medium text-[var(--color-text)]">
                        {reg.athlete.firstName} {reg.athlete.lastName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                        {reg.categoryLabel ?? '—'} · {reg.club?.name ?? '—'} · {reg.athlete.documentId ?? '—'}
                      </p>
                      {last && (
                        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                          Last: {last.weightKg}kg — <span className={D_CLR[last.decision]}>{last.decision}</span>
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: weigh-in form */}
        {selected && (
          <WeighinForm
            selected={selected}
            isPending={recordMut.isPending}
            isResolvePending={resolveMut.isPending}
            t={(key) => t(key as Parameters<typeof t>[0])}
            tC={(key) => tC(key as Parameters<typeof tC>[0])}
            onRecord={handleRecord}
            onMoveUp={(id, nextEventWeightCategoryId) => resolveMut.mutate({ id, action: 'MOVE_UP', nextEventWeightCategoryId })}
            onDQ={(id) => resolveMut.mutate({ id, action: 'DQ' })}
          />
        )}
      </div>
    </div>
  );
}
