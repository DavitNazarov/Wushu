'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { usePublicLive } from '@/hooks/usePublicApi';

type Props = { params: Promise<{ slug: string }> };

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

function statusTone(status: 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED' | undefined) {
  switch (status) {
    case 'RUNNING':
      return 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]';
    case 'UPCOMING':
      return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
    case 'FINISHED':
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
    default:
      return 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
  }
}

export default function PublicEventLivePage({ params }: Props) {
  const { slug } = use(params);
  const tCommon = useTranslations('common');
  const tPublic = useTranslations('public');
  const [matName, setMatName] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = usePublicLive(slug, matName);

  const current = data?.current ?? null;
  const upNext = data?.upNext ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{tPublic('live')}</h1>
        <select
          className={SEL}
          value={matName ?? data?.selectedMatName ?? ''}
          onChange={(e) => setMatName(e.target.value || null)}
        >
          {(data?.mats ?? []).map((mat) => (
            <option key={mat.id} value={mat.name}>
              {mat.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
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
      )}

      {isLoading ? (
        <SkeletonRows rows={3} cols={2} />
      ) : !data ? (
        <EmptyState title={tPublic('noMatData')} />
      ) : (
        <>
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {tPublic('now')}
            </p>
            {!current ? (
              <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">{tPublic('noMatData')}</p>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(
                      current.liveStatus,
                    )}`}
                  >
                    {current.liveStatus ?? 'PENDING'}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    #{current.scheduleOrder ?? '-'} · {current.bracketRoundLabel}
                  </span>
                </div>
                <p className="text-lg font-semibold text-[var(--color-text)]">
                  {current.redDisplayName} vs {current.blueDisplayName}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {tPublic('next')}
            </p>
            <div className="mt-3 space-y-2">
              {upNext.map((fight) => (
                <div
                  key={fight.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(
                        fight.liveStatus,
                      )}`}
                    >
                      {fight.liveStatus ?? 'PENDING'}
                    </span>
                    <span className="text-[12px] text-[var(--color-text-muted)]">
                      #{fight.scheduleOrder ?? '-'} · {fight.bracketRoundLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-[var(--color-text)]">
                    {fight.redDisplayName} vs {fight.blueDisplayName}
                  </p>
                </div>
              ))}
              {upNext.length === 0 && (
                <p className="text-[13px] text-[var(--color-text-muted)]">{tPublic('noMatData')}</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

