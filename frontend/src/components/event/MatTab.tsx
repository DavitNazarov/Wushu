'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { localizedFullName } from '@/lib/bilingual';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicMat } from '@/hooks/usePublicApi';
import type { MatFight } from '@/lib/api/public';

const DEFAULT_MATS = ['Mat 1', 'Mat 2', 'Mat 3'];

export function MatTab({ eventSlug }: { eventSlug: string }) {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const tLive = useTranslations('live');
  const [matName, setMatName] = useState('Mat 1');
  const { data: feed, isLoading, error, refetch } = usePublicMat(eventSlug, matName);

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
        <Skeleton width="120px" height="36px" />
        <Skeleton width="100%" height="150px" />
      </div>
    );
  }

  const matOptions = feed?.mat?.name
    ? [feed.mat.name, ...DEFAULT_MATS.filter((m) => m !== feed.mat.name)]
    : DEFAULT_MATS;

  if (!feed) {
    return (
      <Card>
        <EmptyState title={tPublic('noMatData')} description={undefined} />
      </Card>
    );
  }

  const hasData = feed.now || feed.onDeck || (feed.next && feed.next.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] font-medium text-[var(--color-text-muted)]">
          {tPublic('matSelect')}:
        </label>
        <select
          value={matName}
          onChange={(e) => setMatName(e.target.value)}
          className="h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        >
          {matOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Link
          href={`/mat/${eventSlug}/${encodeURIComponent(matName)}`}
          className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
        >
          {tLive('title')} →
        </Link>
      </div>

      {!hasData ? (
        <Card>
          <EmptyState title={tPublic('noMatData')} description={undefined} />
        </Card>
      ) : (
        <div className="space-y-4">
          {feed.now && (
            <Card className="border-[var(--color-primary)]/40">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                {tPublic('now')}
              </h3>
              <div className="flex items-center justify-between gap-4">
                <div className="text-lg font-semibold text-[var(--color-text)]">
                  {feed.now.redAthlete ? localizedFullName(feed.now.redAthlete.firstName, feed.now.redAthlete.lastName, feed.now.redAthlete.firstNameKa, feed.now.redAthlete.lastNameKa, locale) : 'BYE'}
                </div>
                <span className="text-[var(--color-text-muted)]">vs</span>
                <div className="text-lg font-semibold text-[var(--color-text)]">
                  {feed.now.blueAthlete ? localizedFullName(feed.now.blueAthlete.firstName, feed.now.blueAthlete.lastName, feed.now.blueAthlete.firstNameKa, feed.now.blueAthlete.lastNameKa, locale) : 'BYE'}
                </div>
              </div>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {feed.now.categoryCode} — Bout #{feed.now.boutNo}
              </p>
            </Card>
          )}

          {feed.onDeck && !feed.now && (
            <Card>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {tPublic('onDeck')}
              </h3>
              <p className="text-[15px] font-medium text-[var(--color-text)]">
                {feed.onDeck.redAthlete ? localizedFullName(feed.onDeck.redAthlete.firstName, feed.onDeck.redAthlete.lastName, feed.onDeck.redAthlete.firstNameKa, feed.onDeck.redAthlete.lastNameKa, locale) : 'BYE'} vs {feed.onDeck.blueAthlete ? localizedFullName(feed.onDeck.blueAthlete.firstName, feed.onDeck.blueAthlete.lastName, feed.onDeck.blueAthlete.firstNameKa, feed.onDeck.blueAthlete.lastNameKa, locale) : 'BYE'}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                {feed.onDeck.categoryCode}
              </p>
            </Card>
          )}

          {feed.next && feed.next.length > 0 && (
            <Card>
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {tPublic('next')}
              </h3>
              <ul className="space-y-2">
                {feed.next.map((f: MatFight) => (
                  <li key={f.id} className="text-[13px] text-[var(--color-text)]">
                    {f.redAthlete ? localizedFullName(f.redAthlete.firstName, f.redAthlete.lastName, f.redAthlete.firstNameKa, f.redAthlete.lastNameKa, locale) : 'BYE'} vs {f.blueAthlete ? localizedFullName(f.blueAthlete.firstName, f.blueAthlete.lastName, f.blueAthlete.firstNameKa, f.blueAthlete.lastNameKa, locale) : 'BYE'}
                    <span className="ml-2 text-[var(--color-text-muted)]">{f.categoryCode}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
