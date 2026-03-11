'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { usePublicLive, usePublicMat } from '@/hooks/usePublicApi';
import type { MatFight } from '@/lib/api/public';

type Props = {
  eventSlug: string;
};

type TimerState = MatFight['timerState'];

function athleteName(athlete: MatFight['redAthlete'], byeLabel: string) {
  if (!athlete) return byeLabel;
  return `${athlete.firstName} ${athlete.lastName}`;
}

function useTimerDisplay(timerState: TimerState) {
  const [elapsed, setElapsed] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      if (!timerState) {
        setElapsed(0);
      } else if (timerState.state === 'RUNNING' && timerState.startedAt) {
        setElapsed(Date.now() - new Date(timerState.startedAt).getTime() + timerState.pausedMs);
      } else if (timerState.state === 'PAUSED') {
        setElapsed(timerState.pausedMs);
      } else {
        setElapsed(0);
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [timerState]);

  const seconds = Math.floor(elapsed / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function MatFightRow({ fight, byeLabel, versusLabel }: { fight: MatFight; byeLabel: string; versusLabel: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
      <p className="text-[14px] text-[var(--color-text)]">
        {athleteName(fight.redAthlete, byeLabel)} {versusLabel} {athleteName(fight.blueAthlete, byeLabel)}
      </p>
      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
        {fight.categoryCode} · #{fight.boutNo}
      </p>
    </div>
  );
}

function MatLiveView({ eventSlug, matName, matCount }: { eventSlug: string; matName: string; matCount: number }) {
  const tCommon = useTranslations('common');
  const tPublic = useTranslations('public');
  const tLive = useTranslations('live');
  const { data, isLoading, error, refetch } = usePublicMat(eventSlug, matName);
  const timerDisplay = useTimerDisplay(data?.now?.timerState ?? null);
  const byeLabel = tPublic('bye');
  const versusLabel = tPublic('versus');

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
    return (
      <div className="space-y-4">
        <Skeleton width="180px" height="18px" />
        <Skeleton width="100%" height="180px" />
        <SkeletonRows rows={2} cols={2} />
      </div>
    );
  }

  if (!data) {
    return <EmptyState title={tPublic('noMatData')} description={tPublic('liveUnavailable')} />;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-[var(--color-surface-alt)]/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              {matCount === 1 ? tPublic('liveSingleMatTitle') : tPublic('liveSelectedMatLabel')}
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--color-text)]">{data.mat.name}</h2>
          </div>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {matCount === 1 ? tPublic('liveSingleMatInlineBody') : tPublic('liveMultiMatInlineBody')}
          </p>
        </div>
      </Card>

      <Card className="border-[var(--color-primary)]/30">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          {tLive('currentFight')}
        </p>
        {!data.now ? (
          <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">{tLive('noFights')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-muted)]">
              <span>
                {data.now.categoryCode} · #{data.now.boutNo}
              </span>
              <span>{tPublic('now')}</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="rounded-[var(--radius-card)] bg-[var(--color-danger)]/10 p-4 text-center">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-danger)]">
                  {tLive('red')}
                </p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                  {athleteName(data.now.redAthlete, byeLabel)}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-6 py-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('liveTimer')}
                </p>
                <p className="mt-2 font-mono text-4xl font-bold text-[var(--color-text)]">
                  {timerDisplay}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] bg-sky-500/10 p-4 text-center">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-sky-400">
                  {tLive('blue')}
                </p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                  {athleteName(data.now.blueAthlete, byeLabel)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {tPublic('onDeck')}
          </p>
          <div className="mt-3">
            {data.onDeck ? (
              <MatFightRow fight={data.onDeck} byeLabel={byeLabel} versusLabel={versusLabel} />
            ) : (
              <p className="text-[14px] text-[var(--color-text-muted)]">{tPublic('liveNoOnDeck')}</p>
            )}
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {tPublic('next')}
          </p>
          <div className="mt-3 space-y-2">
            {data.next.length > 0 ? (
              data.next.map((fight) => (
                <MatFightRow key={fight.id} fight={fight} byeLabel={byeLabel} versusLabel={versusLabel} />
              ))
            ) : (
              <p className="text-[14px] text-[var(--color-text-muted)]">{tLive('noUpcoming')}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function PublicLivePanel({ eventSlug }: Props) {
  const tCommon = useTranslations('common');
  const tPublic = useTranslations('public');
  const [matName, setMatName] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = usePublicLive(eventSlug, matName);

  const mats = useMemo(() => data?.mats ?? [], [data?.mats]);
  const selectedMatName = matName ?? data?.selectedMatName ?? mats[0]?.name ?? null;

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

  if (!data || mats.length === 0 || !selectedMatName) {
    return <EmptyState title={tPublic('noMatData')} description={tPublic('liveUnavailable')} />;
  }

  return (
    <div className="space-y-4">
      {mats.length > 1 && (
        <Card className="space-y-4 bg-[var(--color-surface-alt)]/40">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text)]">
              {tPublic('liveMultiMatTitle')}
            </h2>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">
              {tPublic('liveMultiMatInlineBody')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mats.map((mat) => {
              const active = mat.name === selectedMatName;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setMatName(mat.name)}
                  className={`rounded-[var(--radius-card)] border p-4 text-left transition ${
                    active
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/35'
                  }`}
                >
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">{mat.name}</p>
                  <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                    {active ? tPublic('liveSelectedMat') : tPublic('liveSelectMat')}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <MatLiveView eventSlug={eventSlug} matName={selectedMatName} matCount={mats.length} />
    </div>
  );
}
