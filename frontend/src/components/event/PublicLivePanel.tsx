'use client';

import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { FightRoundSummary } from '@/components/fight/FightRoundSummary';
import { LivePhaseBanner } from '@/components/fight/LivePhaseBanner';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PublicLiveSessions } from '@/components/event/PublicLiveSessions';
import {
  usePublicLive,
  usePublicSchedule,
  usePublicScheduleSessions,
} from '@/hooks/usePublicApi';
import { getFightDisplayTone, getFightWinnerCorner } from '@/lib/live/fightPresentation';
import type { PublicLiveFeed } from '@/lib/api/public';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@/lib/bilingual';

/** Coarse round/phase status — no ticking clock on the public page. */
function roundHeadline(
  timerState: NonNullable<PublicLiveFeed['current']>['timerState'],
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (!timerState) return t('phaseWaiting');
  if (timerState.phase === 'FINISHED') return t('phaseFinished');
  if (timerState.phase === 'REST') return t('phaseRest', { round: timerState.currentRound });
  return t('liveRoundRunning', { round: timerState.currentRound });
}

type Props = {
  eventSlug: string;
};

function UpcomingCard({
  label,
  fight,
  locale,
}: {
  label: string;
  fight: PublicLiveFeed['current'];
  locale: string;
}) {
  const tPublic = useTranslations('public');

  return (
    <Card className="border-[var(--color-border)]/80 bg-[var(--color-surface)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      {fight ? (
        <div className="mt-3 space-y-2">
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)} {tPublic('versus')} {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {fight.categoryName} · #{fight.scheduleOrder ?? fight.boutNo} · {fight.bracketRoundLabel}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">
          {tPublic('liveUnavailable')}
        </p>
      )}
    </Card>
  );
}

export function PublicLivePanel({ eventSlug }: Props) {
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const tPublic = useTranslations('public');
  const tLive = useTranslations('live');
  const translateLive = tLive as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  const { data, isLoading, error, refetch } = usePublicLive(eventSlug);
  // Section list comes from the cached schedule endpoints. No socket, no poll —
  // fetched once and refreshed on mount/refocus, edge-cached server-side.
  const { data: scheduleFights } = usePublicSchedule(eventSlug);
  const { data: scheduleSessions } = usePublicScheduleSessions(eventSlug);

  if (error) {
    return (
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
    );
  }

  if (isLoading) {
    return <SkeletonRows rows={3} cols={2} />;
  }

  if (!data) {
    return (
      <EmptyState
        title={tPublic('scheduleNotPublished')}
        description={tPublic('liveUnavailable')}
      />
    );
  }

  const currentFight = data.current;
  const winnerCorner = currentFight
    ? getFightWinnerCorner({
        winnerAthleteId: currentFight.winnerAthleteId,
        redAthleteId: currentFight.redAthleteId,
        blueAthleteId: currentFight.blueAthleteId,
      })
    : null;
  const winnerName =
    winnerCorner === 'RED'
      ? localizedName(currentFight?.redDisplayName ?? '', currentFight?.redDisplayNameKa, locale) || null
      : winnerCorner === 'BLUE'
        ? localizedName(currentFight?.blueDisplayName ?? '', currentFight?.blueDisplayNameKa, locale) || null
        : null;
  const latestResultCorner = data.latestResult
    ? getFightWinnerCorner({
        winnerAthleteId: data.latestResult.winnerAthleteId,
        redAthleteId: data.latestResult.redAthleteId,
        blueAthleteId: data.latestResult.blueAthleteId,
      })
    : null;
  const latestResultWinner =
    latestResultCorner === 'RED'
      ? localizedName(data.latestResult?.redDisplayName ?? '', data.latestResult?.redDisplayNameKa, locale) || null
      : latestResultCorner === 'BLUE'
        ? localizedName(data.latestResult?.blueDisplayName ?? '', data.latestResult?.blueDisplayNameKa, locale) || null
        : null;

  return (
    <div className="space-y-4">
      <Card className="border-[var(--color-primary)]/30 bg-[var(--color-surface)] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
          {tLive('currentFight')}
        </p>

        {!currentFight ? (
          <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">{tLive('noFights')}</p>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--color-text-muted)]">
              <span>
                {currentFight.categoryName} · #{currentFight.scheduleOrder ?? currentFight.boutNo}
              </span>
              <span>{currentFight.bracketRoundLabel}</span>
            </div>

            <LivePhaseBanner
              eyebrow={translateLive('currentPhase')}
              headline={roundHeadline(currentFight.timerState, translateLive)}
              detail={translateLive('roundWinsSummary', {
                red: currentFight.timerState?.redRoundWins ?? 0,
                blue: currentFight.timerState?.blueRoundWins ?? 0,
              })}
              tone={getFightDisplayTone({
                timerState: currentFight.timerState,
                winnerAthleteId: currentFight.winnerAthleteId,
              })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[var(--radius-card)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-subtle)] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-danger)]">
                  {tLive('red')}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
                  {localizedName(currentFight.redDisplayName, currentFight.redDisplayNameKa, locale)}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-sky-500/30 bg-sky-500/12 p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-400">
                  {tLive('blue')}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
                  {localizedName(currentFight.blueDisplayName, currentFight.blueDisplayNameKa, locale)}
                </p>
              </div>
            </div>

            <FightRoundSummary timerState={currentFight.timerState} t={translateLive} />

            {winnerName ? (
              <FightResultBanner
                title={translateLive('fightResult')}
                winnerName={winnerName}
                winnerCorner={winnerCorner}
                methodLabel={
                  currentFight.winMethod
                    ? translateLive(`methods.${currentFight.winMethod}`)
                    : null
                }
                notes={currentFight.notes}
                t={translateLive}
              />
            ) : null}
          </div>
        )}
      </Card>

      {latestResultWinner ? (
        <FightResultBanner
          title={translateLive('latestResult')}
          winnerName={latestResultWinner}
          winnerCorner={latestResultCorner}
          methodLabel={
            data.latestResult?.winMethod
              ? translateLive(`methods.${data.latestResult.winMethod}`)
              : null
          }
          notes={data.latestResult?.notes ?? null}
          t={translateLive}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <UpcomingCard label={tPublic('onDeck')} fight={data.onDeck} locale={locale} />
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            {tPublic('next')}
          </p>
          <div className="mt-3 space-y-3">
            {data.upNext.length > 0 ? (
              data.upNext.map((fight) => (
                <div
                  key={fight.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-4"
                >
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">
                    {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)} {tPublic('versus')} {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                    {fight.categoryName} · #{fight.scheduleOrder ?? fight.boutNo} · {fight.bracketRoundLabel}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[14px] text-[var(--color-text-muted)]">{tLive('noUpcoming')}</p>
            )}
          </div>
        </Card>
      </div>

      <PublicLiveSessions
        fights={scheduleFights ?? []}
        sessions={scheduleSessions ?? []}
        heading={translateLive('sessionsHeading')}
        t={translateLive}
      />
    </div>
  );
}
