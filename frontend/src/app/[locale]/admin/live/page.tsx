'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type {
  LiveBoardFightRow,
  LiveCategoryBoardResponse,
  MatRow,
  TimerState,
} from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventSelection } from '@/hooks/useAdminEventSelection';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const BTN =
  'h-11 rounded-[var(--radius-input)] px-5 text-sm font-semibold transition disabled:opacity-60';

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
      const loop = () => {
        cb();
        raf = requestAnimationFrame(loop);
      };
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

function fightParticipantName(fight: LiveBoardFightRow, side: 'red' | 'blue') {
  return side === 'red' ? fight.red.name : fight.blue.name;
}

export default function LivePage() {
  const t = useTranslations('live');
  const tFight = useTranslations('common.fightStatus');
  const tCommon = useTranslations('common');
  const tBrackets = useTranslations('brackets');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [categoryId, setCategoryId] = useState('');
  const [matId, setMatId] = useState('');
  const [resultOpen, setResultOpen] = useState(false);
  const [winner, setWinner] = useState<'RED' | 'BLUE'>('RED');
  const [method, setMethod] = useState('POINTS');
  const [notes, setNotes] = useState('');

  const { currentEventId, events, selectedEvent, setSelectedEventId } = useAdminEventSelection();
  const eid = currentEventId;
  const gate = resolveEventControlGate('live', selectedEvent);
  const showContent = gate.mode === 'active' || gate.mode === 'readonly';
  const isEditable = gate.mode === 'active';

  const { data: mats } = useQuery({
    queryKey: ['mats', eid],
    queryFn: () => apiGet<MatRow[]>(`/api/mats?eventId=${eid}`),
    enabled: !!eid && showContent,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['live-category-board', eid, categoryId, matId],
    queryFn: () =>
      apiGet<LiveCategoryBoardResponse>(
        `/api/fights/live/category-board?eventId=${eid}${
          categoryId ? `&eventWeightCategoryId=${encodeURIComponent(categoryId)}` : ''
        }${matId ? `&matId=${encodeURIComponent(matId)}` : ''}`,
      ),
    enabled: !!eid && showContent,
  });

  useEffect(() => {
    if (!eid || !showContent) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const onConnect = () => socket.emit('join-event', { eventId: eid });
    const onUpdate = () =>
      void qc.invalidateQueries({
        queryKey: ['live-category-board', eid, categoryId, matId],
      });

    socket.on('connect', onConnect);
    socket.on('fight:update', onUpdate);
    socket.on('schedule:update', onUpdate);
    socket.on('timer:update', onUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('fight:update', onUpdate);
      socket.off('schedule:update', onUpdate);
      socket.off('timer:update', onUpdate);
      socket.close();
    };
  }, [eid, categoryId, matId, qc, showContent]);

  const selectedCategoryId = categoryId || data?.selectedCategoryId || '';
  const board = data?.board ?? null;
  const currentFight = board?.currentFight ?? null;
  const onDeckFight = board?.onDeck ?? null;
  const timerDisplay = useTimer(currentFight?.timerState);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['live-category-board', eid, categoryId, matId] });

  const onErr = (e: unknown) =>
    toast(getCompactErrorMessage(e, t('errorGeneric')), 'error');

  const timerMut = useMutation({
    mutationFn: (payload: {
      id: string;
      action: 'START' | 'PAUSE' | 'RESUME' | 'RESET';
      expectedUpdatedAt?: string | null;
    }) =>
      apiPost(`/api/fights/${payload.id}/timer`, {
        action: payload.action,
        expectedUpdatedAt: payload.expectedUpdatedAt ?? undefined,
      }),
    onSuccess: invalidate,
    onError: onErr,
  });

  const stateMut = useMutation({
    mutationFn: (payload: { id: string; to: string }) =>
      apiPost(`/api/fights/${payload.id}/state`, { to: payload.to }),
    onSuccess: invalidate,
    onError: onErr,
  });

  const resultMut = useMutation({
    mutationFn: (fightId: string) =>
      apiPost(`/api/fights/${fightId}/result`, {
        winner,
        method,
        notes: notes || null,
      }),
    onSuccess: () => {
      invalidate();
      toast(t('resultSuccess'));
      setResultOpen(false);
    },
    onError: onErr,
  });

  const boardContent = (() => {
    if (showContent && isLoading) {
      return <SkeletonRows rows={4} cols={3} />;
    }

    if (showContent && !board) {
      return <EmptyState title={t('noFights')} />;
    }

    if (!showContent || !board) {
      return null;
    }

    const activeBoard = board;

    return (
      <>
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[18px] font-semibold text-[var(--color-text)]">{activeBoard.categoryName}</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {activeBoard.ageGroupName ?? '—'}
              </p>
            </div>
            <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)]">
              {tBrackets(`format.${activeBoard.competitionFormat}`)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
              {t('athletes')}: {activeBoard.athleteCount}
            </div>
            <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
              {t('progress')}: {activeBoard.completedFights}/{activeBoard.totalFights}
            </div>
            <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
              {t('currentStatus')}: {t(`completionState.${activeBoard.completionState}`)}
            </div>
            <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
              {t('needsReview')}: {activeBoard.needsReview ? t('needsReviewYes') : t('needsReviewNo')}
            </div>
          </div>
          {activeBoard.needsReview && activeBoard.issues.length > 0 && (
            <div className="mt-3 rounded-[var(--radius-input)] border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              <p className="font-semibold">{t('issues')}</p>
              <p className="mt-1">{activeBoard.issues.map((issue) => issue.code).join(', ')}</p>
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('currentFight')}
          </p>
          {!currentFight ? (
            <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">{t('noFights')}</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip
                  status={currentFight.status}
                  label={tFight(currentFight.status)}
                  domain="fight"
                />
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  #{currentFight.scheduleOrder ?? currentFight.boutNo} ·{' '}
                  {currentFight.bracketRoundLabel ?? currentFight.stageLabel}
                </span>
              </div>
              <div className="my-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:gap-4">
                <p className="text-xl font-bold text-red-400 sm:text-2xl">
                  {fightParticipantName(currentFight, 'red')}
                </p>
                <div className="text-center">
                  <p className="font-mono text-4xl font-bold text-[var(--color-text)] sm:text-5xl">
                    {timerDisplay}
                  </p>
                </div>
                <p className="text-xl font-bold text-blue-400 sm:text-2xl">
                  {fightParticipantName(currentFight, 'blue')}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {isEditable && currentFight.status === 'QUEUED' && (
                  <SecondaryButton
                    onClick={() => stateMut.mutate({ id: currentFight.id, to: 'ON_DECK' })}
                  >
                    {t('setOnDeck')}
                  </SecondaryButton>
                )}
                {isEditable && currentFight.status === 'ON_DECK' && (
                  <PrimaryButton
                    onClick={() => stateMut.mutate({ id: currentFight.id, to: 'IN_PROGRESS' })}
                  >
                    {t('startFight')}
                  </PrimaryButton>
                )}
                {isEditable && currentFight.status === 'IN_PROGRESS' && (
                  <>
                    {currentFight.timerState?.state === 'RUNNING' ? (
                      <button
                        className={`${BTN} bg-amber-600 text-white hover:bg-amber-700`}
                        onClick={() =>
                          timerMut.mutate({
                            id: currentFight.id,
                            action: 'PAUSE',
                            expectedUpdatedAt: currentFight.timerState?.updatedAt ?? null,
                          })
                        }
                      >
                        {t('pause')}
                      </button>
                    ) : (
                      <button
                        className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700`}
                        onClick={() =>
                          timerMut.mutate({
                            id: currentFight.id,
                            action: 'START',
                            expectedUpdatedAt: currentFight.timerState?.updatedAt ?? null,
                          })
                        }
                      >
                        {t('start')}
                      </button>
                    )}
                  </>
                )}
                {isEditable && currentFight.status === 'PAUSED' && (
                  <button
                    className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700`}
                    onClick={() =>
                      timerMut.mutate({
                        id: currentFight.id,
                        action: 'RESUME',
                        expectedUpdatedAt: currentFight.timerState?.updatedAt ?? null,
                      })
                    }
                  >
                    {t('resume')}
                  </button>
                )}
                {isEditable &&
                  (currentFight.status === 'IN_PROGRESS' || currentFight.status === 'PAUSED') && (
                  <SecondaryButton
                    onClick={() =>
                      timerMut.mutate({
                        id: currentFight.id,
                        action: 'RESET',
                        expectedUpdatedAt: currentFight.timerState?.updatedAt ?? null,
                      })
                    }
                  >
                    {t('reset')}
                  </SecondaryButton>
                )}
                {isEditable && (
                  <PrimaryButton
                    disabled={!currentFight.isPlayable}
                    onClick={() => {
                      setWinner('RED');
                      setMethod('POINTS');
                      setNotes('');
                      setResultOpen(true);
                    }}
                  >
                    {t('setResult')}
                  </PrimaryButton>
                )}
              </div>
            </>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('onDeck')}
          </p>
          {!onDeckFight ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">{t('noUpcoming')}</p>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={onDeckFight.status} label={tFight(onDeckFight.status)} domain="fight" />
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  #{onDeckFight.scheduleOrder ?? onDeckFight.boutNo} ·{' '}
                  {onDeckFight.bracketRoundLabel ?? onDeckFight.stageLabel}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[var(--color-text)]">
                {onDeckFight.red.name} vs {onDeckFight.blue.name}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('next')}
          </p>
          <div className="space-y-2">
            {activeBoard.queue.map((fight) => (
              <div
                key={fight.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={fight.status} label={tFight(fight.status)} domain="fight" />
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    #{fight.scheduleOrder ?? fight.boutNo} ·{' '}
                    {fight.bracketRoundLabel ?? fight.stageLabel}
                  </span>
                  {!fight.isPlayable && (
                    <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      waiting
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-[var(--color-text)]">
                  {fight.red.name} vs {fight.blue.name}
                </p>
              </div>
            ))}
            {activeBoard.queue.length === 0 && (
              <p className="text-[13px] text-[var(--color-text-muted)]">{t('noUpcoming')}</p>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('completedHistory')}
          </p>
          <div className="space-y-2">
            {activeBoard.completed.map((fight) => (
              <div
                key={fight.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  #{fight.scheduleOrder ?? fight.boutNo} ·{' '}
                  {fight.bracketRoundLabel ?? fight.stageLabel}
                </p>
                <p className="text-[13px] text-[var(--color-text)]">
                  {fight.red.name} vs {fight.blue.name}
                </p>
              </div>
            ))}
            {activeBoard.completed.length === 0 && (
              <p className="text-[13px] text-[var(--color-text-muted)]">{t('noCompleted')}</p>
            )}
          </div>
        </section>
      </>
    );
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex flex-wrap gap-2">
            <select className={SEL} value={eid} onChange={(e) => setSelectedEventId(e.target.value)}>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            {showContent && (
              <>
                <select
                  className={SEL}
                  value={selectedCategoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {(data?.categories ?? []).map((category) => (
                    <option key={category.eventWeightCategoryId} value={category.eventWeightCategoryId}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
                <select className={SEL} value={matId} onChange={(e) => setMatId(e.target.value)}>
                  <option value="">{t('selectMat')}</option>
                  {(mats ?? []).map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        }
      />

      {eid && gate.mode !== 'active' && (
        <EventPhaseGate
          gate={gate}
          locale={locale}
          t={(key, values) =>
            tGate(
              key as Parameters<typeof tGate>[0],
              values as Record<string, string | number | Date> | undefined,
            )
          }
          tEvents={(key) => tEvents(key as Parameters<typeof tEvents>[0])}
        />
      )}

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {boardContent}

      {isEditable && (
        <Modal
          open={resultOpen && !!currentFight}
          onClose={() => setResultOpen(false)}
          title={t('setResult')}
          footer={
            <>
              <SecondaryButton onClick={() => setResultOpen(false)}>
                {tCommon('cancel')}
              </SecondaryButton>
              <PrimaryButton
                disabled={resultMut.isPending}
                onClick={() => currentFight && resultMut.mutate(currentFight.id)}
              >
                {resultMut.isPending ? tCommon('loading') : t('confirm')}
              </PrimaryButton>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[13px] text-[var(--color-text-muted)]">
                {t('winner')}
              </label>
              <div className="flex gap-2">
                {(['RED', 'BLUE'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setWinner(side)}
                    className={`flex-1 rounded-[var(--radius-input)] border py-2.5 text-sm font-semibold transition ${
                      winner === side
                        ? `${
                            side === 'RED'
                              ? 'border-red-500 bg-red-600'
                              : 'border-blue-500 bg-blue-600'
                          } text-white`
                        : 'border-[var(--color-border)] text-[var(--color-text)]'
                    }`}
                  >
                    {side === 'RED'
                      ? currentFight?.red.name ?? t('red')
                      : currentFight?.blue.name ?? t('blue')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">
                {t('method')}
              </label>
              <select className={`${SEL} w-full`} value={method} onChange={(e) => setMethod(e.target.value)}>
                {(['POINTS', 'KO', 'DQ', 'WO'] as const).map((m) => (
                  <option key={m} value={m}>
                    {t(`methods.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">
                {t('notes')}
              </label>
              <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
