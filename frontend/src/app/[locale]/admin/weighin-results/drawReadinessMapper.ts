import type { DrawCategoryOverviewRow } from '@/types/api';

export type DrawCategoryFilter =
  | 'ALL'
  | 'READY'
  | 'BLOCKED'
  | 'DRAWN'
  | 'EMPTY'
  | 'SOLO'
  | 'NEEDS_REVIEW';

export type DrawCategorySort =
  | 'CATEGORY'
  | 'ATHLETES_DESC'
  | 'STATUS'
  | 'AGE_GROUP';

const STATUS_ORDER: Record<DrawCategoryOverviewRow['readinessStatus'], number> = {
  READY: 1,
  NEEDS_REVIEW: 2,
  SOLO: 3,
  BLOCKED: 4,
  DRAWN: 5,
  EMPTY: 6,
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
