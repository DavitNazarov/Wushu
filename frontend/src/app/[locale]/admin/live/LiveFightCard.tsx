'use client';

import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { FightRoundSummary } from '@/components/fight/FightRoundSummary';
import { LivePhaseBanner } from '@/components/fight/LivePhaseBanner';
import { StatusChip } from '@/components/ui/StatusChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  getFightDisplayTone,
  getFightWinnerCorner,
} from '@/lib/live/fightPresentation';
import type { LiveQueueFightRow } from '@/types/live';

const BTN =
  'h-11 rounded-[var(--radius-input)] px-5 text-sm font-semibold transition disabled:opacity-60';

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

function competitorTone(
  slot: 'RED' | 'BLUE',
  winnerCorner: 'RED' | 'BLUE' | null,
) {
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
  if (!fight) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </p>
        <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">{emptyLabel}</p>
      </section>
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

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

      <div className="mt-4 space-y-4">
        <LivePhaseBanner
          eyebrow={t('currentPhase')}
          headline={phaseLabel ?? t('phaseWaiting')}
          timerDisplay={timerDisplay}
          timerLabel={t('timer')}
          detail={roundWinsLabel}
          tone={tone}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className={`rounded-[var(--radius-card)] border p-5 ${competitorTone('RED', winnerCorner)}`}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-danger)]">
              {t('red')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
              {fight.redDisplayName}
            </p>
          </div>

          <div className={`rounded-[var(--radius-card)] border p-5 ${competitorTone('BLUE', winnerCorner)}`}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-400">
              {t('blue')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
              {fight.blueDisplayName}
            </p>
          </div>
        </div>

        <FightRoundSummary timerState={fight.timerState} t={t} />

        {winnerName ? (
          <FightResultBanner
            title={t('fightResult')}
            winnerName={winnerName}
            winnerCorner={winnerCorner}
            methodLabel={methodLabel}
            notes={fight.notes}
            t={t}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <span>{fight.categoryName}</span>
          {fight.ageGroupName ? <span>• {fight.ageGroupName}</span> : null}
          <span>• {fight.isPlayable ? tSchedule('fightReady') : tSchedule('fightWaiting')}</span>
          {fight.matName ? <span>• {fight.matName}</span> : null}
        </div>

        {awaitingRoundResult ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-4 py-3 text-[14px] font-medium text-[var(--color-text)]">
            {t('awaitingRoundResult')}
          </div>
        ) : null}

        {actionConfig ? (
          <div className="flex flex-wrap gap-2">
            {fight.status === 'QUEUED' && actionConfig.onSetOnDeck ? (
              <SecondaryButton onClick={actionConfig.onSetOnDeck}>
                {t('setOnDeck')}
              </SecondaryButton>
            ) : null}
            {fight.status === 'ON_DECK' && actionConfig.onStartFight ? (
              <PrimaryButton onClick={actionConfig.onStartFight}>
                {t('startFight')}
              </PrimaryButton>
            ) : null}
            {fight.timerState?.state === 'RUNNING' && actionConfig.onPause ? (
              <button
                className={`${BTN} bg-amber-600 text-white hover:bg-amber-700`}
                onClick={actionConfig.onPause}
              >
                {t('pause')}
              </button>
            ) : null}
            {!awaitingRoundResult &&
            fight.timerState?.state === 'PAUSED' &&
            actionConfig.onResume ? (
              <button
                className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700`}
                onClick={actionConfig.onResume}
              >
                {t('resume')}
              </button>
            ) : null}
            {awaitingRoundResult && actionConfig.onRedRoundWin ? (
              <PrimaryButton onClick={actionConfig.onRedRoundWin}>
                {t('redWinsRound')}
              </PrimaryButton>
            ) : null}
            {awaitingRoundResult && actionConfig.onBlueRoundWin ? (
              <PrimaryButton onClick={actionConfig.onBlueRoundWin}>
                {t('blueWinsRound')}
              </PrimaryButton>
            ) : null}
            {actionConfig.onSetResult ? (
              <SecondaryButton disabled={!fight.isPlayable} onClick={actionConfig.onSetResult}>
                {t('setResult')}
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
