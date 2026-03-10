'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import type { WeighInListEntry } from '@/types/weighin';
import { WeighInAthleteRow } from './WeighInAthleteRow';

type Props = {
  groups: Array<{
    key: string;
    headingLabel: string;
    entries: WeighInListEntry[];
  }>;
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  t: (key: string) => string;
};

export function WeighInAthleteList({
  groups,
  selectedId,
  isLoading,
  onSelect,
  t,
}: Props) {
  if (isLoading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <SkeletonRows rows={8} cols={1} />
      </div>
    );
  }

  if (!groups.length) {
    return (
      <EmptyState
        title={t('queueEmptyTitle')}
        description={t('queueEmptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2 pt-1 first:pt-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate text-[14px] font-bold text-[var(--color-text)]">
              {group.headingLabel}
            </h3>
            <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
              ({group.entries.length})
            </span>
            <span className="h-px w-full bg-[var(--color-border)]" />
          </div>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <WeighInAthleteRow
                key={entry.id}
                entry={entry}
                selected={selectedId === entry.id}
                onSelect={onSelect}
                t={t}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
