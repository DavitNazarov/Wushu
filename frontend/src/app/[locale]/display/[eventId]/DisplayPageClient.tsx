'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import {
  getFightDisplayTone,
  getFightWinnerCorner,
  getRoundSlotState,
  type FightDisplayTone,
  type FightRoundSlotState,
} from '@/lib/live/fightPresentation';
import {
  formatTimerMs,
  getTimerRemainingMs,
  isAwaitingRoundResult,
} from '@/lib/live/timer';
import type { LiveQueueBoardResponse, LiveQueueFightRow } from '@/types/live';

/* ── Timer tone accent ── */
const TIMER_TONE: Record<FightDisplayTone, string> = {
  live: 'border-[var(--color-primary)]/40 bg-[var(--color-primary-subtle)]',
  rest: 'border-[var(--color-warning)]/45 bg-[var(--color-warning-subtle)]',
  finished: 'border-[var(--color-success)]/45 bg-[var(--color-success-subtle)]',
  idle: 'border-[var(--color-border)] bg-[var(--color-surface-alt)]',
};

/* ── Round pill colors ── */
function roundPillClass(state: FightRoundSlotState): string {
  if (state === 'RED')
    return 'border-[var(--color-danger)]/50 bg-[var(--color-danger-subtle)] text-[var(--color-danger)]';
  if (state === 'BLUE')
    return 'border-sky-500/50 bg-sky-500/12 text-sky-400';
  if (state === 'ACTIVE')
    return 'border-[var(--color-primary)]/55 bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
  if (state === 'NEXT')
    return 'border-[var(--color-warning)]/50 bg-[var(--color-warning-subtle)] text-[var(--color-warning)]';
  return 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
}

function roundPillLabel(state: FightRoundSlotState, t: (key: string) => string): string {
  if (state === 'RED') return t('roundWonByRed');
  if (state === 'BLUE') return t('roundWonByBlue');
  if (state === 'ACTIVE') return t('roundActive');
  if (state === 'NEXT') return t('roundNext');
  return t('roundPending');
}

/* ══════════════════════════════════════════════════════════ */
/*  High-precision timer — requestAnimationFrame, no drift   */
/* ══════════════════════════════════════════════════════════ */
function useDisplayTimer(timerState: LiveQueueFightRow['timerState']) {
  const [display, setDisplay] = useState('00:00');
  const rafRef = useRef<number>(0);
  const timerStateRef = useRef(timerState);
  timerStateRef.current = timerState;

  useEffect(() => {
    function tick() {
      const remaining = getTimerRemainingMs(timerStateRef.current);
      setDisplay(formatTimerMs(remaining));
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timerState?.state, timerState?.phaseStartedAt, timerState?.elapsed, timerState?.phase]);

  return display;
}

/* ══════════════════════════════════════════════════════════ */
/*  Display Page — full-screen TV view, no admin chrome      */
/* ══════════════════════════════════════════════════════════ */
type Props = {
  eventId: string;
};

export function DisplayPageClient({ eventId }: Props) {
  const t = useTranslations('live');
  const locale = useLocale();

  const liveQueryKey = useMemo(
    () => ['display-board', eventId] as const,
    [eventId],
  );

  const liveQuery = useQuery({
    queryKey: liveQueryKey,
    queryFn: () =>
      apiGet<LiveQueueBoardResponse>(
        `/api/fights/live/queue-board?eventId=${eventId}`,
      ),
    enabled: !!eventId,
    refetchInterval: 10_000,
  });

  const { isConnected } = useRealtimeQuerySync({
    scope: 'display',
    eventId,
    enabled: !!eventId,
    queryKeys: [liveQueryKey],
  });

  const currentFight = liveQuery.data?.currentFight ?? null;
  const onDeckFight = liveQuery.data?.onDeckFight ?? null;
  const timerDisplay = useDisplayTimer(currentFight?.timerState ?? null);
  const awaiting = isAwaitingRoundResult(currentFight?.timerState ?? null);

  const tone = getFightDisplayTone({
    timerState: currentFight?.timerState ?? null,
    winnerAthleteId: currentFight?.winnerAthleteId,
  });

  const winnerCorner = currentFight
    ? getFightWinnerCorner({
        winnerAthleteId: currentFight.winnerAthleteId,
        redAthleteId: currentFight.redAthleteId,
        blueAthleteId: currentFight.blueAthleteId,
      })
    : null;

  const phaseLabel = (() => {
    const timer = currentFight?.timerState;
    if (!timer) return null;
    if (timer.phase === 'REST')
      return t('phaseRest' as Parameters<typeof t>[0], { round: timer.currentRound });
    if (timer.phase === 'FINISHED') return t('phaseFinished' as Parameters<typeof t>[0]);
    return t('phaseRound' as Parameters<typeof t>[0], { round: timer.currentRound });
  })();

  /* ── Idle state: no current fight ── */
  if (!currentFight) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)]">
        <div className="absolute right-6 top-6">
          <span className={`inline-block h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        </div>

        <p className="text-4xl font-bold text-[var(--color-text-muted)] sm:text-5xl">
          {t('noFights' as Parameters<typeof t>[0])}
        </p>

        {onDeckFight && (
          <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-10 py-6 text-center">
            <p className="text-lg font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('onDeck' as Parameters<typeof t>[0])}
            </p>
            <div className="mt-4 flex items-center gap-6">
              <span className="text-3xl font-bold text-[var(--color-danger)]">
                {localizedName(onDeckFight.redDisplayName, onDeckFight.redDisplayNameKa, locale)}
              </span>
              <span className="text-xl font-bold text-[var(--color-text-muted)]">vs</span>
              <span className="text-3xl font-bold text-sky-400">
                {localizedName(onDeckFight.blueDisplayName, onDeckFight.blueDisplayNameKa, locale)}
              </span>
            </div>
            <p className="mt-3 text-lg text-[var(--color-text-muted)]">
              {onDeckFight.categoryName} · {onDeckFight.bracketRoundLabel}
            </p>
          </div>
        )}
      </div>
    );
  }

  /* ── Active fight display ── */
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      {/* Connection indicator */}
      <div className="absolute right-6 top-6 z-10">
        <span className={`inline-block h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
      </div>

      {/* ── Fight info bar ── */}
      <div className="flex items-center justify-center gap-4 px-6 py-4">
        <span className="text-lg font-semibold text-[var(--color-text-muted)]">
          #{currentFight.orderInSession ?? currentFight.orderInMat ?? currentFight.scheduleOrder ?? currentFight.boutNo}
        </span>
        <span className="text-lg text-[var(--color-text-muted)]">·</span>
        <span className="text-lg font-medium text-[var(--color-text-muted)]">
          {currentFight.categoryName}
        </span>
        {currentFight.ageGroupName && (
          <>
            <span className="text-lg text-[var(--color-text-muted)]">·</span>
            <span className="text-lg text-[var(--color-text-muted)]">
              {currentFight.ageGroupName}
            </span>
          </>
        )}
        <span className="text-lg text-[var(--color-text-muted)]">·</span>
        <span className="text-lg text-[var(--color-text-muted)]">
          {currentFight.bracketRoundLabel}
        </span>
      </div>

      {/* ── Timer + Phase — hero center ── */}
      <div className="flex flex-col items-center px-6 pb-4 pt-2">
        <div className={`w-full max-w-2xl rounded-[var(--radius-card)] border px-8 py-6 text-center ${TIMER_TONE[tone]}`}>
          {phaseLabel && (
            <p className="text-xl font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              {phaseLabel}
            </p>
          )}
          <p className="mt-2 font-mono text-[8rem] font-bold leading-none tracking-tight text-[var(--color-text)] sm:text-[10rem]">
            {timerDisplay}
          </p>
          {currentFight.timerState && (
            <p className="mt-3 text-xl text-[var(--color-text-muted)]">
              {t('roundWinsSummary' as Parameters<typeof t>[0], {
                red: currentFight.timerState.redRoundWins,
                blue: currentFight.timerState.blueRoundWins,
              })}
            </p>
          )}
        </div>
      </div>

      {/* ── Competitors: RED vs BLUE ── */}
      <div className="flex flex-1 items-center px-6 pb-6">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-stretch gap-4">
          {/* RED corner */}
          <div
            className={`rounded-[var(--radius-card)] border p-8 transition-all ${
              winnerCorner === 'RED'
                ? 'border-[var(--color-danger)]/60 bg-[var(--color-danger-subtle)] ring-2 ring-[var(--color-danger)]/30'
                : 'border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8'
            }`}
          >
            <p className="text-2xl font-bold uppercase tracking-[0.3em] text-[var(--color-danger)]">
              {t('red' as Parameters<typeof t>[0])}
            </p>
            <p className="mt-4 text-5xl font-bold text-[var(--color-text)] sm:text-6xl lg:text-7xl">
              {localizedName(currentFight.redDisplayName, currentFight.redDisplayNameKa, locale)}
            </p>
            {winnerCorner === 'RED' && (
              <p className="mt-4 text-2xl font-bold uppercase tracking-wider text-[var(--color-danger)]">
                {t('winner' as Parameters<typeof t>[0])}
              </p>
            )}
          </div>

          {/* VS divider */}
          <div className="flex items-center">
            <span className="text-3xl font-black uppercase text-[var(--color-text-muted)]">
              vs
            </span>
          </div>

          {/* BLUE corner */}
          <div
            className={`rounded-[var(--radius-card)] border p-8 transition-all ${
              winnerCorner === 'BLUE'
                ? 'border-sky-500/60 bg-sky-500/12 ring-2 ring-sky-500/30'
                : 'border-sky-500/25 bg-sky-500/8'
            }`}
          >
            <p className="text-2xl font-bold uppercase tracking-[0.3em] text-sky-400">
              {t('blue' as Parameters<typeof t>[0])}
            </p>
            <p className="mt-4 text-5xl font-bold text-[var(--color-text)] sm:text-6xl lg:text-7xl">
              {localizedName(currentFight.blueDisplayName, currentFight.blueDisplayNameKa, locale)}
            </p>
            {winnerCorner === 'BLUE' && (
              <p className="mt-4 text-2xl font-bold uppercase tracking-wider text-sky-400">
                {t('winner' as Parameters<typeof t>[0])}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Round progress pills ── */}
      {currentFight.timerState && (
        <div className="flex items-center justify-center gap-4 px-6 pb-6">
          {[1, 2, 3].map((roundNumber) => {
            const roundState = getRoundSlotState({
              timerState: currentFight.timerState,
              roundNumber,
            });
            return (
              <div
                key={roundNumber}
                className={`rounded-[var(--radius-pill)] border px-6 py-3 text-center ${roundPillClass(roundState)}`}
              >
                <span className="text-lg font-bold uppercase tracking-wide">
                  {t('roundShort' as Parameters<typeof t>[0], { round: roundNumber })}
                </span>
                <span className="ml-3 text-lg font-semibold">
                  {roundPillLabel(roundState, (key) =>
                    t(key as Parameters<typeof t>[0]),
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Win method banner ── */}
      {winnerCorner && currentFight.winMethod && (
        <div className="flex justify-center px-6 pb-6">
          <div className="rounded-[var(--radius-pill)] border border-current/10 bg-black/10 px-8 py-3">
            <span className="text-2xl font-bold text-[var(--color-text)]">
              {t('wonByMethod' as Parameters<typeof t>[0], {
                method: t(`methods.${currentFight.winMethod}` as Parameters<typeof t>[0]),
              })}
            </span>
          </div>
        </div>
      )}

      {/* ── Awaiting round result indicator ── */}
      {awaiting && (
        <div className="flex justify-center px-6 pb-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-8 py-4">
            <p className="text-2xl font-bold text-[var(--color-text)]">
              {t('awaitingRoundResult' as Parameters<typeof t>[0])}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
