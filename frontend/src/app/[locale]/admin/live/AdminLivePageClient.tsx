'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventSelection } from '@/hooks/useAdminEventSelection';
import { useFightTimerDisplay } from '@/hooks/useFightTimerDisplay';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import type { LiveQueueBoardResponse, LiveQueueFightRow } from '@/types/live';
import { LiveFightCard } from './LiveFightCard';
import { LiveQueueList } from './LiveQueueList';
import { LiveResultModal } from './LiveResultModal';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

function phaseLabel(
  fight: LiveQueueFightRow | null,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const timer = fight?.timerState;
  if (!timer) return null;
  if (timer.phase === 'REST') {
    return t('phaseRest', { round: timer.currentRound });
  }
  if (timer.phase === 'FINISHED') {
    return t('phaseFinished');
  }
  return t('phaseRound', { round: timer.currentRound });
}

export function AdminLivePageClient() {
  const t = useTranslations('live');
  const tCommon = useTranslations('common');
  const tFight = useTranslations('common.fightStatus');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const tSchedule = useTranslations('schedule');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resultOpen, setResultOpen] = useState(false);
  const [winner, setWinner] = useState<'RED' | 'BLUE'>('RED');
  const [method, setMethod] = useState('POINTS');
  const [notes, setNotes] = useState('');
  const { currentEventId, events, selectedEvent, setSelectedEventId } = useAdminEventSelection();
  const gate = resolveEventControlGate('live', selectedEvent);
  const showContent = gate.mode === 'active' || gate.mode === 'readonly';
  const isEditable = gate.mode === 'active';
  const liveQueryKey = useMemo(() => ['live-queue-board', currentEventId] as const, [currentEventId]);
  const liveQuery = useQuery({
    queryKey: liveQueryKey,
    queryFn: () =>
      apiGet<LiveQueueBoardResponse>(`/api/fights/live/queue-board?eventId=${currentEventId}`),
    enabled: !!currentEventId && showContent,
  });
  const { isConnected, lastSyncAt } = useRealtimeQuerySync({
    scope: 'admin-live',
    eventId: currentEventId || null,
    enabled: !!currentEventId && showContent,
    queryKeys: [liveQueryKey],
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['live-queue-board', currentEventId],
    });
  const onError = (error: unknown) =>
    toast(getCompactErrorMessage(error, t('errorGeneric')), 'error');

  const timerMutation = useMutation({
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
    onError,
  });

  const startFightMutation = useMutation({
    mutationFn: (fightId: string) => apiPost(`/api/fights/${fightId}/start`),
    onSuccess: invalidate,
    onError,
  });

  const stateMutation = useMutation({
    mutationFn: (payload: { id: string; to: string }) =>
      apiPost(`/api/fights/${payload.id}/state`, { to: payload.to }),
    onSuccess: invalidate,
    onError,
  });

  const resultMutation = useMutation({
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
    onError,
  });

  const roundResultMutation = useMutation({
    mutationFn: (payload: { fightId: string; winner: 'RED' | 'BLUE' }) =>
      apiPost(`/api/fights/${payload.fightId}/round-result`, {
        winner: payload.winner,
        expectedUpdatedAt: currentFight?.timerState?.updatedAt ?? undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast(t('roundResultSaved'));
    },
    onError,
  });

  const currentFight = liveQuery.data?.currentFight ?? null;
  const timerDisplay = useFightTimerDisplay(currentFight?.timerState ?? null);
  const currentPhaseLabel = phaseLabel(currentFight, (key, values) =>
    t(key as Parameters<typeof t>[0], values),
  );
  const currentRoundWinsLabel = currentFight?.timerState
    ? t('roundWinsSummary', {
        red: currentFight.timerState.redRoundWins,
        blue: currentFight.timerState.blueRoundWins,
      })
    : null;
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : t('syncPending');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('controlRoom')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select className={SEL} value={currentEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <div className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
              <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>● </span>
              {t('realtime')}: {isConnected ? t('connected') : t('disconnected')} · {t('lastSync')}: {lastSyncLabel}
            </div>
          </div>
        }
      />

      {currentEventId && gate.mode !== 'active' && (
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

      {liveQuery.error && (
        <AdminErrorAlert
          error={liveQuery.error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => liveQuery.refetch()}
        />
      )}

      {showContent && liveQuery.isLoading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : showContent ? (
        !currentFight &&
        (liveQuery.data?.nextFights.length ?? 0) === 0 &&
        (liveQuery.data?.queuePreview.length ?? 0) === 0 &&
        (liveQuery.data?.completedFights.length ?? 0) === 0 ? (
          <EmptyState title={tSchedule('emptyTitle')} description={tSchedule('emptyDescription')} />
        ) : (
        <>
          <LiveFightCard
            fight={currentFight}
            title={t('currentFight')}
            emptyLabel={t('noFights')}
            timerDisplay={timerDisplay.display}
            phaseLabel={currentPhaseLabel}
            roundWinsLabel={currentRoundWinsLabel}
            awaitingRoundResult={timerDisplay.awaitingRoundResult}
            actionConfig={
              isEditable && currentFight
                ? {
                    onSetOnDeck: () => stateMutation.mutate({ id: currentFight.id, to: 'ON_DECK' }),
                    onStartFight: () => startFightMutation.mutate(currentFight.id),
                    onPause: () =>
                      timerMutation.mutate({
                        id: currentFight.id,
                        action: 'PAUSE',
                        expectedUpdatedAt: currentFight.timerState?.updatedAt ?? null,
                      }),
                    onResume: () =>
                      timerMutation.mutate({
                        id: currentFight.id,
                        action: 'RESUME',
                        expectedUpdatedAt: currentFight.timerState?.updatedAt ?? null,
                      }),
                    onRedRoundWin: () =>
                      roundResultMutation.mutate({
                        fightId: currentFight.id,
                        winner: 'RED',
                      }),
                    onBlueRoundWin: () =>
                      roundResultMutation.mutate({
                        fightId: currentFight.id,
                        winner: 'BLUE',
                      }),
                    onSetResult: () => setResultOpen(true),
                  }
                : undefined
            }
            t={(key) => t(key as Parameters<typeof t>[0])}
            tFight={(key) => tFight(key as Parameters<typeof tFight>[0])}
            tSchedule={(key) => tSchedule(key as Parameters<typeof tSchedule>[0])}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <LiveFightCard
              fight={liveQuery.data?.onDeckFight ?? null}
              title={t('onDeck')}
              emptyLabel={t('noUpcoming')}
              t={(key) => t(key as Parameters<typeof t>[0])}
              tFight={(key) => tFight(key as Parameters<typeof tFight>[0])}
              tSchedule={(key) => tSchedule(key as Parameters<typeof tSchedule>[0])}
            />
            <LiveQueueList
              fights={liveQuery.data?.nextFights ?? []}
              title={t('next')}
              emptyLabel={t('noUpcoming')}
              t={(key, values) => t(key as Parameters<typeof t>[0], values)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <LiveQueueList
              fights={liveQuery.data?.queuePreview ?? []}
              title={t('queuePreview')}
              emptyLabel={t('noQueue')}
              t={(key, values) => t(key as Parameters<typeof t>[0], values)}
            />
            <LiveQueueList
              fights={liveQuery.data?.completedFights ?? []}
              title={t('completedHistory')}
              emptyLabel={t('noCompleted')}
              t={(key, values) => t(key as Parameters<typeof t>[0], values)}
            />
          </div>
        </>
        )
      ) : null}

      {isEditable && currentFight && (
        <LiveResultModal
          open={resultOpen}
          fight={currentFight}
          winner={winner}
          method={method}
          notes={notes}
          onClose={() => setResultOpen(false)}
          onConfirm={() => resultMutation.mutate(currentFight.id)}
          onWinnerChange={setWinner}
          onMethodChange={setMethod}
          onNotesChange={setNotes}
          t={(key) => t(key as Parameters<typeof t>[0])}
          tCommon={(key) => tCommon(key as Parameters<typeof tCommon>[0])}
        />
      )}
    </div>
  );
}
