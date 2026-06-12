import type {
  CategorySelection,
  EventCategoriesResponse,
  EventRow,
  ValidationIssue,
} from '@/types/api';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoToDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function buildIssuesByPath(issues: ValidationIssue[] | null | undefined) {
  const map = new Map<string, string[]>();
  (issues ?? []).forEach((issue) => {
    map.set(issue.path, [...(map.get(issue.path) ?? []), issue.message]);
  });
  return map;
}

export function buildEventDays(rangeStart: string, rangeEnd: string): string[] {
  if (!rangeStart || !rangeEnd) return [];
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function getInitialEventDateFields(event: EventRow) {
  return {
    rangeStart: event.dates?.range.startDate ?? isoToDate(event.competitionStartDate),
    rangeEnd: event.dates?.range.endDate ?? isoToDate(event.competitionEndDate),
    registrationDays:
      event.dates?.registrationDays ?? [isoToDate(event.registrationStartDate)].filter(Boolean),
    fightDays:
      event.dates?.fightDays ?? [isoToDate(event.competitionStartDate)].filter(Boolean),
    regOpensAt:
      event.dates?.registrationWindow?.opensAt ?? isoToDate(event.registrationOpensAt),
    regClosesAt:
      event.dates?.registrationWindow?.closesAt ?? isoToDate(event.registrationClosesAt),
  };
}

export function buildInitialCategorySelection(
  existingCategories: EventCategoriesResponse | undefined,
  fallbackCategoryTemplateId: string | null,
): CategorySelection | null {
  if (!existingCategories || !existingCategories.ageGroups.length) return null;
  return {
    categoryTemplateId:
      existingCategories.categoryTemplateId ?? fallbackCategoryTemplateId ?? '',
    ageGroups: existingCategories.ageGroups.map((ageGroup) => ({
      categoryTemplateGroupId: ageGroup.categoryTemplateGroupId,
      weightCategoryIds: ageGroup.weightCategories.map(
        (weightCategory) => weightCategory.categoryTemplateCategoryId,
      ),
    })),
  };
}
