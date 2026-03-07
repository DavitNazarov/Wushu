'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import type { EventRow, MatRow, FightRow, TimerState } from '@/types/api';

type LiveFight = FightRow & { timerState?: TimerState | null; categoryLabel?: string };

const SEL = 'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const INPUT = 'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const BTN = 'h-11 rounded-[var(--radius-input)] px-5 text-sm font-semibold transition disabled:opacity-60';

function athleteName(a?: { firstName: string; lastName: string } | null) {
  return a ? `${a.firstName} ${a.lastName}` : 'BYE';
}

function formatMs(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function useTimer(ts: TimerState | null | undefined) {
  const running = ts?.state === 'RUNNING';
  const elapsed = ts?.elapsed ?? 0;
  const startedAt = ts?.startedAt ?? null;

  const sub = useCallback(
    (cb: () => void) => {
      if (!running) return () => {};
      let raf: number;
      const loop = () => { cb(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    },
    [running],
  );

  const snap = useCallback(() => {
    if (!running || !startedAt) return formatMs(elapsed);
    return formatMs(Date.now() - new Date(startedAt).getTime() + elapsed);
  }, [running, startedAt, elapsed]);

  return useSyncExternalStore(sub, snap, () => formatMs(elapsed));
}

export default function LivePage() {
  const t = useTranslations('live');
  const tFight = useTranslations('common.fightStatus');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();

  const [eventId, setEventId] = useState('');
  const [matId, setMatId] = useState('');
  const [resultOpen, setResultOpen] = useState(false);
  const [winner, setWinner] = useState<'RED' | 'BLUE'>('RED');
  const [method, setMethod] = useState('POINTS');
  const [notes, setNotes] = useState('');

  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => apiGet<EventRow[]>('/api/events') });
  const eid = eventId || events?.[0]?.id || '';
  const { data: mats } = useQuery({ queryKey: ['mats', eid], queryFn: () => apiGet<MatRow[]>(`/api/mats?eventId=${eid}`), enabled: !!eid });
  const mid = matId || mats?.[0]?.id || '';

  const { data: fights, isLoading, error, refetch } = useQuery({
    queryKey: ['fights', eid, mid],
    queryFn: () => apiGet<LiveFight[]>(`/api/fights?eventId=${eid}&matId=${mid}`),
    enabled: !!eid && !!mid,
    refetchInterval: 5000,
  });

  const current = fights?.find((f) => f.status === 'IN_PROGRESS' || f.status === 'PAUSED');
  const onDeck = fights?.find((f) => f.status === 'ON_DECK');
  const nextUp = fights?.filter((f) => f.status === 'QUEUED').slice(0, 3) ?? [];
  const timerDisplay = useTimer(current?.timerState);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['fights', eid, mid] });
  const onErr = () => toast(t('errorGeneric'), 'error');

  const timerMut = useMutation({
    mutationFn: (p: { id: string; action: string; expectedUpdatedAt?: string | null }) =>
      apiPost(`/api/fights/${p.id}/timer`, {
        action: p.action,
        expectedUpdatedAt: p.expectedUpdatedAt ?? undefined,
      }),
    onSuccess: invalidate, onError: onErr,
  });
  const stateMut = useMutation({
    mutationFn: (p: { id: string; to: string }) => apiPost(`/api/fights/${p.id}/state`, { to: p.to }),
    onSuccess: invalidate, onError: onErr,
  });
  const resultMut = useMutation({
    mutationFn: (fightId: string) => apiPost(`/api/fights/${fightId}/result`, { winner, method, notes: notes || null }),
    onSuccess: () => { invalidate(); toast(t('resultSuccess')); setResultOpen(false); },
    onError: onErr,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex gap-2">
            <select className={SEL} value={eid} onChange={(e) => setEventId(e.target.value)}>
              {events?.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            <select className={SEL} value={mid} onChange={(e) => setMatId(e.target.value)}>
              {mats?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        }
      />

      {error && (
        <InlineAlert variant="error" actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tCommon('retry')}</button>}>
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <SkeletonRows rows={3} cols={3} />
      ) : !current ? (
        <div className="space-y-4">
          <EmptyState title={t('noFights')} />
          {onDeck && (
            <div className="mx-auto max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-warning)]">{t('onDeck')}</span>
              <p className="mt-2 text-base font-semibold text-[var(--color-text)]">
                {athleteName(onDeck.redAthlete)} <span className="text-[var(--color-text-muted)]">vs</span> {athleteName(onDeck.blueAthlete)}
              </p>
              <PrimaryButton className="mt-4" onClick={() => stateMut.mutate({ id: onDeck.id, to: 'IN_PROGRESS' })}>{t('startFight')}</PrimaryButton>
            </div>
          )}
          {!onDeck && nextUp.length > 0 && (
            <div className="text-center">
              <SecondaryButton onClick={() => stateMut.mutate({ id: nextUp[0].id, to: 'ON_DECK' })}>{t('setOnDeck')}</SecondaryButton>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="mb-1 flex items-center gap-2">
              <StatusChip status={current.status} label={tFight(current.status)} domain="fight" />
              {current.categoryLabel && <span className="text-[12px] text-[var(--color-text-muted)]">{current.categoryLabel}</span>}
            </div>
            {/* Round duration badge — sourced from fight.roundDurationSeconds */}
            {current.roundDurationSeconds && (
              <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Round {current.roundDurationSeconds / 60}min
              </p>
            )}
            <div className="my-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:gap-4">
              <p className="text-xl font-bold text-red-400 sm:text-2xl">{athleteName(current.redAthlete)}</p>
              <div className="text-center">
                <p className="font-mono text-4xl font-bold text-[var(--color-text)] sm:text-5xl">{timerDisplay}</p>
                {current.roundDurationSeconds && (
                  <p className="mt-0.5 font-mono text-[13px] text-[var(--color-text-muted)]">
                    / {String(Math.floor(current.roundDurationSeconds / 60)).padStart(2, '0')}:{String(current.roundDurationSeconds % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
              <p className="text-xl font-bold text-blue-400 sm:text-2xl">{athleteName(current.blueAthlete)}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {current.status === 'IN_PROGRESS' ? (
                <button
                  className={`${BTN} bg-amber-600 text-white hover:bg-amber-700`}
                  onClick={() => timerMut.mutate({ id: current.id, action: 'PAUSE', expectedUpdatedAt: current.timerState?.updatedAt ?? null })}
                >
                  {t('pause')}
                </button>
              ) : (
                <button
                  className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700`}
                  onClick={() =>
                    timerMut.mutate({
                      id: current.id,
                      action: current.timerState?.state === 'PAUSED' ? 'RESUME' : 'START',
                      expectedUpdatedAt: current.timerState?.updatedAt ?? null,
                    })
                  }
                >
                  {current.timerState?.state === 'PAUSED' ? t('resume') : t('start')}
                </button>
              )}
              <SecondaryButton
                onClick={() => timerMut.mutate({ id: current.id, action: 'RESET', expectedUpdatedAt: current.timerState?.updatedAt ?? null })}
              >
                {t('reset')}
              </SecondaryButton>
              <PrimaryButton onClick={() => { setWinner('RED'); setMethod('POINTS'); setNotes(''); setResultOpen(true); }}>{t('setResult')}</PrimaryButton>
              <SecondaryButton onClick={() => stateMut.mutate({ id: current.id, to: 'COMPLETE' })}>{t('complete')}</SecondaryButton>
            </div>
          </div>
          {onDeck && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-warning)]">{t('onDeck')}</span>
              <p className="mt-1 text-[13px] text-[var(--color-text)]">{athleteName(onDeck.redAthlete)} vs {athleteName(onDeck.blueAthlete)}</p>
            </div>
          )}
          {nextUp.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{t('next')}</p>
              <div className="space-y-2">
                {nextUp.map((f) => (
                  <div key={f.id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] text-[var(--color-text)]">
                    {athleteName(f.redAthlete)} vs {athleteName(f.blueAthlete)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={resultOpen && !!current}
        onClose={() => setResultOpen(false)}
        title={t('setResult')}
        footer={
          <>
            <SecondaryButton onClick={() => setResultOpen(false)}>{tCommon('cancel')}</SecondaryButton>
            <PrimaryButton disabled={resultMut.isPending} onClick={() => current && resultMut.mutate(current.id)}>
              {resultMut.isPending ? tCommon('loading') : t('confirm')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[13px] text-[var(--color-text-muted)]">{t('winner')}</label>
            <div className="flex gap-2">
              {(['RED', 'BLUE'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setWinner(side)}
                  className={`flex-1 rounded-[var(--radius-input)] border py-2.5 text-sm font-semibold transition ${winner === side ? `${side === 'RED' ? 'border-red-500 bg-red-600' : 'border-blue-500 bg-blue-600'} text-white` : 'border-[var(--color-border)] text-[var(--color-text)]'}`}
                >
                  {t(side === 'RED' ? 'red' : 'blue')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('method')}</label>
            <select className={`${SEL} w-full`} value={method} onChange={(e) => setMethod(e.target.value)}>
              {(['POINTS', 'KO', 'DQ', 'WO'] as const).map((m) => (
                <option key={m} value={m}>{t(`methods.${m}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('notes')}</label>
            <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
