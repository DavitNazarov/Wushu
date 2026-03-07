'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicBrackets } from '@/hooks/usePublicApi';
import type { PublicBracket, BracketFight } from '@/lib/api/public';

function athleteName(a: { firstName: string; lastName: string } | null | undefined): string {
  if (!a) return 'BYE';
  return `${a.firstName} ${a.lastName}`;
}

export function BracketsTab({ eventSlug }: { eventSlug: string }) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const tBrackets = useTranslations('brackets');
  const { data: brackets, isLoading, error, refetch } = usePublicBrackets(eventSlug);

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
        <Skeleton width="100%" height="120px" />
        <Skeleton width="100%" height="120px" />
      </div>
    );
  }

  if (!brackets || brackets.length === 0) {
    return (
      <Card>
        <EmptyState title={tPublic('bracketsNotPublished')} description={undefined} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {brackets.map((bracket: PublicBracket) => (
        <Card key={bracket.id}>
          <h3 className="mb-4 text-[15px] font-semibold text-[var(--color-text)]">
            {bracket.categoryCode}
          </h3>
          {bracket.fights && bracket.fights.length > 0 ? (
            <div className="space-y-2">
              {bracket.fights.map((f: BracketFight) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-[var(--color-text-muted)]">
                    R{f.round} #{f.boutNo}
                  </span>
                  <span className="text-[var(--color-text)]">
                    {athleteName(f.redAthlete)} {tBrackets('vs')} {athleteName(f.blueAthlete)}
                  </span>
                  {f.winnerAthlete && (
                    <span className="text-[11px] text-[var(--color-success)]">
                      → {athleteName(f.winnerAthlete)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {tPublic('bracketsNotPublished')}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
