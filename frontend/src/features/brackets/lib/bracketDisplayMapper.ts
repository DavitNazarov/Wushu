import type {
  BracketIssue,
  BracketsOverviewCategoryRow,
  BracketViewStatus,
} from '@/types/api';

export type BracketCategoryFilter =
  | 'ALL'
  | 'PUBLISHED'
  | 'DRAFT'
  | 'NEEDS_REVIEW'
  | 'EMPTY'
  | 'MOVED_UP';

export type BracketCategorySort =
  | 'CATEGORY'
  | 'ATHLETES_DESC'
  | 'STATUS'
  | 'AGE_GROUP'
  | 'UPDATED_DESC';

const STATUS_ORDER: Record<BracketViewStatus, number> = {
  NEEDS_REVIEW: 1,
  IN_PROGRESS: 2,
  GENERATED_DRAFT: 3,
  PUBLISHED: 4,
  COMPLETED: 5,
  NOT_GENERATED: 6,
  EMPTY: 7,
};

export function filterAndSortBracketCategories(input: {
  categories: BracketsOverviewCategoryRow[];
  filter: BracketCategoryFilter;
  sort: BracketCategorySort;
}): BracketsOverviewCategoryRow[] {
  const filtered = input.categories.filter((row) => {
    if (input.filter === 'ALL') return true;
    if (input.filter === 'PUBLISHED') {
      return row.publicationStatus === 'PUBLISHED' && row.fightCount > 0;
    }
    if (input.filter === 'DRAFT') {
      return row.publicationStatus === 'DRAFT' && row.fightCount > 0;
    }
    if (input.filter === 'NEEDS_REVIEW') {
      return row.status === 'NEEDS_REVIEW';
    }
    if (input.filter === 'EMPTY') {
      return row.status === 'EMPTY' || row.status === 'NOT_GENERATED';
    }
    return row.movedUpAthletesCount > 0;
  });

  if (input.sort === 'ATHLETES_DESC') {
    return [...filtered].sort((a, b) => {
      const diff = b.athleteCount - a.athleteCount;
      if (diff !== 0) return diff;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }

  if (input.sort === 'STATUS') {
    return [...filtered].sort((a, b) => {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (diff !== 0) return diff;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }

  if (input.sort === 'AGE_GROUP') {
    return [...filtered].sort((a, b) => {
      const diff = a.ageGroupName.localeCompare(b.ageGroupName);
      if (diff !== 0) return diff;
      return a.sortOrder - b.sortOrder;
    });
  }

  if (input.sort === 'UPDATED_DESC') {
    return [...filtered].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }

  return [...filtered].sort((a, b) => {
    const diff = a.sortOrder - b.sortOrder;
    if (diff !== 0) return diff;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

export function bracketStatusBadgeClasses(status: BracketViewStatus): string {
  if (status === 'COMPLETED') {
    return 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'IN_PROGRESS') {
    return 'border border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
  if (status === 'NEEDS_REVIEW') {
    return 'border border-red-500/30 bg-red-500/10 text-red-300';
  }
  if (status === 'PUBLISHED') {
    return 'border border-sky-500/30 bg-sky-500/10 text-sky-300';
  }
  if (status === 'GENERATED_DRAFT') {
    return 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-300';
  }
  if (status === 'EMPTY') {
    return 'border border-slate-400/30 bg-slate-400/10 text-slate-300';
  }
  return 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
}

export function issueSeverityClass(issue: BracketIssue): string {
  if (issue.severity === 'CRITICAL') {
    return 'border border-red-500/30 bg-red-500/10 text-red-300';
  }
  return 'border border-amber-500/30 bg-amber-500/10 text-amber-300';
}
