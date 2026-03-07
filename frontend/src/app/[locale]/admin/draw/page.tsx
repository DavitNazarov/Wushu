'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import type { EventRow, BracketRow } from '@/types/api';

const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export default function DrawPage() {
  const t = useTranslations('draw');
  const tC = useTranslations('common');
  const qc = useQueryClient();
  const locale = useLocale();
  const { toast } = useToast();

  const [selectedEventId, setSelectedEventId] = useState('');
  const [seed, setSeed] = useState('');
  const [sameClub, setSameClub] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetReason, setResetReason] = useState('');

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const eventId = selectedEventId || events?.[0]?.id || '';

  const { data: brackets, isLoading, error, refetch } = useQuery({
    queryKey: ['brackets', eventId],
    queryFn: () => apiGet<BracketRow[]>(`/api/brackets?eventId=${eventId}`),
    enabled: !!eventId,
  });

  const drawMut = useMutation({
    mutationFn: () =>
      apiPost('/api/draw', {
        eventId,
        sameClubSeparation: sameClub,
        seed: seed ? parseInt(seed, 10) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', eventId] });
      toast(t('drawSuccess'));
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : tC('error');
      toast(msg, 'error');
    },
  });

  const resetMut = useMutation({
    mutationFn: () =>
      apiPost('/api/draw/reset', { eventId, override: true, reason: resetReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brackets', eventId] });
      toast(t('resetSuccess'));
      setResetOpen(false);
      setResetConfirm('');
      setResetReason('');
    },
    onError: () => toast(tC('error'), 'error'),
  });

  const rows = brackets ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <select className={SEL} value={eventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            {events?.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>

        }
      />

      {error && (
        <InlineAlert
          variant="error"
          actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tC('retry')}</button>}
        >
          {tC('loadError')}
        </InlineAlert>
      )}

      {/* Draw options */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">
              {t('seed')}
            </label>
            <input
              type="number"
              className={`${INPUT} !w-32`}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="random"
            />
          </div>
          <label className="flex items-center gap-2 pb-0.5 text-[13px] text-[var(--color-text)]">
            <input type="checkbox" checked={sameClub} onChange={(e) => setSameClub(e.target.checked)} />
            {t('sameClubSeparation')}
          </label>
          <PrimaryButton disabled={drawMut.isPending || !eventId} onClick={() => drawMut.mutate()}>
            {drawMut.isPending ? tC('loading') : t('runDraw')}
          </PrimaryButton>
        </div>
      </div>

      {/* Brackets display */}
      {isLoading ? (
        <SkeletonRows rows={3} cols={2} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {rows.length} {t('bracketsGenerated')}
            </p>
            <Link
              href={`/${locale}/admin/brackets`}
              className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
            >
              {t('viewBrackets')} →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((b) => {
              const totalFights = b.fights?.length ?? 0;
              const done = b.fights?.filter(f => f.status === 'CONFIRMED').length ?? 0;
              return (
                <div
                  key={b.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <p className="text-[13px] font-semibold text-[var(--color-text)]">{b.categoryCode}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {totalFights} {tC('fights')} · {done} {tC('done')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset section */}
      <div className="border-t border-[var(--color-border)] pt-6">
        <SecondaryButton
          className="!border-[var(--color-danger)]/40 !text-[var(--color-danger)]"
          onClick={() => { setResetOpen(true); setResetConfirm(''); setResetReason(''); }}
        >
          {t('resetDraw')}
        </SecondaryButton>
      </div>

      {/* Reset confirmation modal */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t('resetDraw')}
        description={t('resetWarning')}
        footer={
          <>
            <SecondaryButton onClick={() => setResetOpen(false)}>
              {tC('cancel')}
            </SecondaryButton>
            <PrimaryButton
              className="!bg-[var(--color-danger)] hover:!opacity-80"
              disabled={resetMut.isPending || resetConfirm !== 'CONFIRM' || !resetReason.trim()}
              onClick={() => resetMut.mutate()}
            >
              {resetMut.isPending ? tC('loading') : t('resetDraw')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text)]">
              {t('reasonLabel')}
            </label>
            <input
              className={`mt-1 ${INPUT}`}
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text)]">
              {t('confirmReset')}
            </label>
            <input
              className={`mt-1 ${INPUT}`}
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="CONFIRM"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
