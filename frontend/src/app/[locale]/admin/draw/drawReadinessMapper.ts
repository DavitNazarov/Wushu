import type { DrawCategoryOverviewRow } from '@/types/api';

export type DrawCategoryFilter =
  | 'ALL'
  | 'READY'
  | 'BLOCKED'
  | 'DRAWN'
  | 'EMPTY'
  | 'NEEDS_REVIEW';

export type DrawCategorySort =
  | 'CATEGORY'
  | 'ATHLETES_DESC'
  | 'STATUS'
  | 'AGE_GROUP';

const STATUS_ORDER: Record<DrawCategoryOverviewRow['readinessStatus'], number> = {
  READY: 1,
  NEEDS_REVIEW: 2,
  BLOCKED: 3,
  DRAWN: 4,
  EMPTY: 5,
};

export function filterAndSortCategories(input: {
  categories: DrawCategoryOverviewRow[];
  filter: DrawCategoryFilter;
  onlyWithAthletes?: boolean;
  sort: DrawCategorySort;
}): DrawCategoryOverviewRow[] {
  const statusFiltered =
    input.filter === 'ALL'
      ? [...input.categories]
      : input.categories.filter((row) => row.readinessStatus === input.filter);

  const filtered = input.onlyWithAthletes
    ? statusFiltered.filter((row) => row.eligibleAthletesCount > 0)
    : statusFiltered;

  if (input.sort === 'ATHLETES_DESC') {
    return filtered.sort((a, b) => {
      const diff = b.eligibleAthletesCount - a.eligibleAthletesCount;
      if (diff !== 0) return diff;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }

  if (input.sort === 'STATUS') {
    return filtered.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.readinessStatus] - STATUS_ORDER[b.readinessStatus];
      if (statusDiff !== 0) return statusDiff;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }

  if (input.sort === 'AGE_GROUP') {
    return filtered.sort((a, b) => {
      const ageDiff = a.ageGroupName.localeCompare(b.ageGroupName);
      if (ageDiff !== 0) return ageDiff;
      return a.sortOrder - b.sortOrder;
    });
  }

  return filtered.sort((a, b) => {
    const byWeight = a.sortOrder - b.sortOrder;
    if (byWeight !== 0) return byWeight;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

export function readinessStatusTone(status: DrawCategoryOverviewRow['readinessStatus']):
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral' {
  if (status === 'READY') return 'success';
  if (status === 'NEEDS_REVIEW') return 'warning';
  if (status === 'BLOCKED') return 'error';
  if (status === 'DRAWN') return 'info';
  return 'neutral';
}

export function statusBadgeClasses(status: DrawCategoryOverviewRow['readinessStatus']): string {
  const tone = readinessStatusTone(status);
  if (tone === 'success') {
    return 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (tone === 'warning') {
    return 'border border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
  if (tone === 'error') {
    return 'border border-red-500/30 bg-red-500/10 text-red-300';
  }
  if (tone === 'info') {
    return 'border border-sky-500/30 bg-sky-500/10 text-sky-300';
  }
  return 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
}
