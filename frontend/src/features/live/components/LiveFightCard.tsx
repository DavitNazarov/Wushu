'use client';

import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { StatusChip } from '@/components/ui/StatusChip';
import { Card } from '@/components/ui/primitives/card';
import {
  getFightDisplayTone,
  getFightWinnerCorner,
  getRoundSlotState,
  type FightRoundSlotState,
} from '@/lib/live/fightPresentation';
import { isNextRoundBlocked } from '@/lib/live/timer';
import type { LiveQueueFightRow } from '@/types/live';

type ActionConfig = {
  onSetOnDeck?: (() => void) | null;
  onStartFight?: (() => void) | null;
  onPause?: (() => void) | null;
  onResume?: (() => void) | null;
  onRedRoundWin?: (() => void) | null;
  onBlueRoundWin?: (() => void) | null;
  onSetResult?: (() => void) | null;
};

type Props = {
  fight: LiveQueueFightRow | null;
  title: string;
  emptyLabel: string;
  timerDisplay?: string | null;
  phaseLabel?: string | null;
  roundWinsLabel?: string | null;
  awaitingRoundResult?: boolean;
  actionConfig?: ActionConfig;
  t: (key: string, values?: Record<string, string | number>) => string;
  tFight: (key: string) => string;
  tSchedule: (key: string) => string;
};

/* ── Tone styles for the phase/timer hero strip ── */
const TONE_BG: Record<string, string> = {
  live: 'border-[var(--color-primary)]/40 bg-[var(--color-primary-subtle)]',
  rest: 'border-[var(--color-warning)]/45 bg-[var(--color-warning-subtle)]',
  finished: 'border-[var(--color-success)]/45 bg-[var(--color-success-subtle)]',
  idle: 'border-[var(--color-border)] bg-[var(--color-surface-alt)]',
};

/* ── Compact round pill colors ── */
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

function roundPillLabel(state: FightRoundSlotState, t: Props['t']): string {
  if (state === 'RED') return t('roundWonByRed');
  if (state === 'BLUE') return t('roundWonByBlue');
  if (state === 'ACTIVE') return t('roundActive');
  if (state === 'NEXT') return t('roundNext');
  return t('roundPending');
}

/* ── Competitor card tone ── */
function competitorTone(slot: 'RED' | 'BLUE', winnerCorner: 'RED' | 'BLUE' | null) {
  if (slot === 'RED') {
    return winnerCorner === 'RED'
      ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger-subtle)] ring-1 ring-[var(--color-danger)]/25'
      : 'border-[var(--color-danger)]/20 bg-[var(--color-danger)]/8';
  }
  return winnerCorner === 'BLUE'
    ? 'border-sky-500/50 bg-sky-500/12 ring-1 ring-sky-500/25'
    : 'border-sky-500/20 bg-sky-500/8';
}

export function LiveFightCard({
  fight,
  title,
  emptyLabel,
  timerDisplay,
  phaseLabel,
  roundWinsLabel,
  awaitingRoundResult,
  actionConfig,
  t,
  tFight,
  tSchedule,
}: Props) {
  /* ── Empty state ── */
  if (!fight) {
    return (
      <Card className="p-5 !shadow-none">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </p>
        <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">{emptyLabel}</p>
      </Card>
    );
  }

  const winnerCorner = getFightWinnerCorner({
    winnerAthleteId: fight.winnerAthleteId,
    redAthleteId: fight.redAthleteId,
    blueAthleteId: fight.blueAthleteId,
  });
  const tone = getFightDisplayTone({
    timerState: fight.timerState,
    winnerAthleteId: fight.winnerAthleteId,
  });
  const winnerName =
    winnerCorner === 'RED'
      ? fight.redDisplayName
      : winnerCorner === 'BLUE'
        ? fight.blueDisplayName
        : null;
  const methodLabel = fight.winMethod ? t(`methods.${fight.winMethod}`) : null;
  const nextRoundBlocked = isNextRoundBlocked(fight.timerState);
  const isControlPanel = !!actionConfig;

  return (
    <Card className={`overflow-hidden !shadow-[var(--shadow-card)] ${isControlPanel ? '' : 'p-5'}`}>
      {/* ── Header bar ── */}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${isControlPanel ? 'px-5 pt-5' : ''}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={fight.status} label={tFight(fight.status)} domain="fight" />
          <span className="text-[12px] text-[var(--color-text-muted)]">
            #{fight.orderInMat ?? fight.scheduleOrder ?? fight.boutNo} · {fight.bracketRoundLabel}
          </span>
        </div>
      </div>

      <div className={`${isControlPanel ? 'px-5 pb-5' : ''} mt-4 space-y-4`}>
        {/* ── Phase + Timer hero (control panel only) ── */}
        {isControlPanel && (
          <div className={`rounded-[var(--radius-card)] border px-5 py-5 text-center ${TONE_BG[tone]}`}>
            {phaseLabel && (
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                {phaseLabel}
              </p>
            )}
            {timerDisplay && (
              <p className="mt-2 font-mono text-6xl font-bold leading-none tracking-tight text-[var(--color-text)] sm:text-7xl">
                {timerDisplay}
              </p>
            )}
            {roundWinsLabel && (
              <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">{roundWinsLabel}</p>
            )}
          </div>
        )}

        {/* ── Competitors: RED vs BLUE ── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
          <div className={`rounded-[var(--radius-card)] border p-4 ${competitorTone('RED', winnerCorner)}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-danger)]">
              {t('red')}
            </p>
            <p className={`mt-2 font-semibold text-[var(--color-text)] ${isControlPanel ? 'text-xl sm:text-2xl' : 'text-lg'}`}>
              {fight.redDisplayName}
            </p>
          </div>

          <div className="flex items-center">
            <span className="text-[13px] font-bold uppercase text-[var(--color-text-muted)]">vs</span>
          </div>

          <div className={`rounded-[var(--radius-card)] border p-4 ${competitorTone('BLUE', winnerCorner)}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400">
              {t('blue')}
            </p>
            <p className={`mt-2 font-semibold text-[var(--color-text)] ${isControlPanel ? 'text-xl sm:text-2xl' : 'text-lg'}`}>
              {fight.blueDisplayName}
            </p>
          </div>
        </div>

        {/* ── Compact round progress pills ── */}
        {fight.timerState && (
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((roundNumber) => {
              const roundState = getRoundSlotState({ timerState: fight.timerState, roundNumber });
              return (
                <div
                  key={roundNumber}
                  className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-center ${roundPillClass(roundState)}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {t('roundShort', { round: roundNumber })}
                  </span>
                  <span className="ml-1.5 text-[11px] font-medium">
                    {roundPillLabel(roundState, t)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Result banner (finished fights) ── */}
        {winnerName && (
          <FightResultBanner
            title={t('fightResult')}
            winnerName={winnerName}
            winnerCorner={winnerCorner}
            methodLabel={methodLabel}
            notes={fight.notes}
            compact={!isControlPanel}
            t={t}
          />
        )}

        {/* ── Metadata footer ── */}
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
          <span>{fight.categoryName}</span>
          {fight.ageGroupName ? <span>· {fight.ageGroupName}</span> : null}
          <span>· {fight.isPlayable ? tSchedule('fightReady') : tSchedule('fightWaiting')}</span>
          {fight.matName ? <span>· {fight.matName}</span> : null}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* ── ACTION ZONE (control panel only) ────────── */}
        {/* ══════════════════════════════════════════════ */}
        {actionConfig && (
          <div className="space-y-3 pt-1">
            {/* ── Awaiting round result: big RED / BLUE winner buttons ── */}
            {awaitingRoundResult && (
              <>
                <div className="rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-4 py-3 text-center text-[14px] font-medium text-[var(--color-text)]">
                  {t(nextRoundBlocked ? 'nextRoundBlocked' : 'awaitingRoundResult')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {actionConfig.onRedRoundWin && (
                    <button
                      type="button"
                      onClick={actionConfig.onRedRoundWin}
                      className="flex h-14 items-center justify-center rounded-[var(--radius-card)] border-2 border-[var(--color-danger)] bg-[var(--color-danger)] text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-110 active:scale-[0.98]"
                    >
                      {t('redWinsRound')}
                    </button>
                  )}
                  {actionConfig.onBlueRoundWin && (
                    <button
                      type="button"
                      onClick={actionConfig.onBlueRoundWin}
                      className="flex h-14 items-center justify-center rounded-[var(--radius-card)] border-2 border-sky-500 bg-sky-500 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-110 active:scale-[0.98]"
                    >
                      {t('blueWinsRound')}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── Timer controls: big Pause / Resume ── */}
            {fight.timerState?.state === 'RUNNING' && actionConfig.onPause && (
              <button
                type="button"
                onClick={actionConfig.onPause}
                className="flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] bg-amber-600 text-[15px] font-bold uppercase tracking-wide text-white transition hover:bg-amber-700 active:scale-[0.98]"
              >
                {t('pause')}
              </button>
            )}
            {!awaitingRoundResult &&
              fight.timerState?.state === 'PAUSED' &&
              actionConfig.onResume && (
                <button
                  type="button"
                  onClick={actionConfig.onResume}
                  className="flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] bg-emerald-600 text-[15px] font-bold uppercase tracking-wide text-white transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  {t('resume')}
                </button>
              )}

            {/* ── State transitions: Set On Deck / Start Fight ── */}
            {fight.status === 'QUEUED' && actionConfig.onSetOnDeck && (
              <button
                type="button"
                onClick={actionConfig.onSetOnDeck}
                className="flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[15px] font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface)] active:scale-[0.98]"
              >
                {t('setOnDeck')}
              </button>
            )}
            {fight.status === 'ON_DECK' && actionConfig.onStartFight && (
              <button
                type="button"
                onClick={actionConfig.onStartFight}
                className="flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-primary)] text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-110 active:scale-[0.98]"
              >
                {t('startFight')}
              </button>
            )}

            {/* ── Set result (secondary) ── */}
            {actionConfig.onSetResult && (
              <button
                type="button"
                disabled={!fight.isPlayable}
                onClick={actionConfig.onSetResult}
                className="flex h-10 w-full items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[13px] font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:pointer-events-none"
              >
                {t('setResult')}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
