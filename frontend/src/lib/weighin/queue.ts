import type { AthleteSex } from '@/types/api';
import type { WeighInListEntry } from '@/types/weighin';

export type WeighInQueueGroup = {
  key: string;
  heading: {
    categoryLabel: string | null;
    ageGroupName: string | null;
    sex: AthleteSex | null;
    weightLabel: string | null;
  };
  entries: WeighInListEntry[];
};

export type WeighInQueueHeadingLabels = {
  maleDivisionLabel: string;
  femaleDivisionLabel: string;
  unknownAgeLabel: string;
  unknownDivisionLabel: string;
  unknownWeightLabel: string;
};

type GroupSortMeta = {
  divisionPriority: number;
  weightValue: number | null;
  fallbackKey: string;
};

const DIVISION_PRIORITY = {
  girls: 1,
  women: 2,
  boys: 3,
  men: 4,
} as const;

const UNKNOWN_DIVISION_PRIORITY = 5;
const NO_PARSED_WEIGHT_RANK = Number.POSITIVE_INFINITY;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function parseWeightFromLabel(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getWeightSortValue(entry: WeighInListEntry): number | null {
  const current = entry.eventWeightCategory?.rulesetWeightCategory;
  const registered = entry.registeredEventWeightCategory?.rulesetWeightCategory;

  if (current?.maxWeightKgIncl != null) return current.maxWeightKgIncl;
  if (current?.minWeightKgExcl != null) return current.minWeightKgExcl + 0.001;
  if (registered?.maxWeightKgIncl != null) return registered.maxWeightKgIncl;
  if (registered?.minWeightKgExcl != null) return registered.minWeightKgExcl + 0.001;

  return (
    parseWeightFromLabel(current?.name) ??
    parseWeightFromLabel(registered?.name) ??
    parseWeightFromLabel(entry.categoryLabel) ??
    parseWeightFromLabel(entry.categoryCode)
  );
}

function getWeightLabel(entry: WeighInListEntry): string | null {
  return (
    entry.eventWeightCategory?.rulesetWeightCategory.name ??
    entry.registeredEventWeightCategory?.rulesetWeightCategory.name ??
    null
  );
}

function isUnder18Division(input: {
  ageGroupCode: string | null;
  ageGroupName: string | null;
  minAge: number | null;
  maxAge: number | null;
}): boolean | null {
  const { ageGroupCode, ageGroupName, minAge, maxAge } = input;

  if (minAge != null && minAge >= 18) return false;
  if (maxAge != null && maxAge < 18) return true;

  const normalized = normalizeText(`${ageGroupCode ?? ''} ${ageGroupName ?? ''}`);
  if (/\bkids?\b|\bchildren\b|\byouth\b|\bcadet\b|\bjunior\b|\bu\d+\b/.test(normalized)) return true;
  if (/\b18\+\b|\badult\b|\bsenior\b/.test(normalized)) return false;
  return null;
}

function normalizeDivisionLabel(value: string): keyof typeof DIVISION_PRIORITY | null {
  const normalized = normalizeText(value);
  if (normalized.includes('girls') || normalized.includes('girl') || normalized.includes('გოგოები')) {
    return 'girls';
  }
  if (normalized.includes('women') || normalized.includes('woman') || normalized.includes('ქალები')) {
    return 'women';
  }
  if (normalized.includes('boys') || normalized.includes('boy') || normalized.includes('ბიჭები')) {
    return 'boys';
  }
  if (normalized.includes('men') || normalized.includes('man') || normalized.includes('კაცები')) {
    return 'men';
  }
  return null;
}

function getDivisionPriority(entry: WeighInListEntry): number {
  const ageGroup = entry.eventWeightCategory?.eventAgeGroup.rulesetAgeGroup;
  const normalizedFromLabels = normalizeDivisionLabel(
    `${ageGroup?.name ?? ''} ${entry.categoryLabel ?? ''} ${entry.categoryCode ?? ''}`,
  );
  if (normalizedFromLabels) return DIVISION_PRIORITY[normalizedFromLabels];

  const isUnder18 = isUnder18Division({
    ageGroupCode: ageGroup?.code ?? null,
    ageGroupName: ageGroup?.name ?? null,
    minAge: ageGroup?.minAge ?? null,
    maxAge: ageGroup?.maxAge ?? null,
  });
  const sex = ageGroup?.sex ?? entry.athlete.sex ?? null;

  if (sex === 'FEMALE') {
    return isUnder18 === true ? DIVISION_PRIORITY.girls : DIVISION_PRIORITY.women;
  }
  if (sex === 'MALE') {
    return isUnder18 === true ? DIVISION_PRIORITY.boys : DIVISION_PRIORITY.men;
  }

  return UNKNOWN_DIVISION_PRIORITY;
}

function getQueueNumber(entry: WeighInListEntry): number | null {
  if (typeof entry.queueNumber !== 'number' || !Number.isFinite(entry.queueNumber)) {
    return null;
  }
  return entry.queueNumber;
}

function getEntrySortMeta(entry: WeighInListEntry): GroupSortMeta {
  const divisionPriority = getDivisionPriority(entry);
  const weightValue = getWeightSortValue(entry);
  const fallbackKey = `${entry.categoryCode ?? ''}::${entry.categoryLabel ?? ''}::${entry.id}`;

  return {
    divisionPriority,
    weightValue,
    fallbackKey,
  };
}

function compareQueueEntries(a: WeighInListEntry, b: WeighInListEntry): number {
  const queueA = getQueueNumber(a);
  const queueB = getQueueNumber(b);
  if (queueA != null && queueB != null && queueA !== queueB) return queueA - queueB;
  if (queueA != null && queueB == null) return -1;
  if (queueA == null && queueB != null) return 1;

  const createdAtA = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
  const createdAtB = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
  const hasCreatedAtA = Number.isFinite(createdAtA);
  const hasCreatedAtB = Number.isFinite(createdAtB);

  if (hasCreatedAtA && hasCreatedAtB && createdAtA !== createdAtB) {
    return createdAtA - createdAtB;
  }
  if (hasCreatedAtA && !hasCreatedAtB) return -1;
  if (!hasCreatedAtA && hasCreatedAtB) return 1;

  const nameA = `${a.athlete.lastName} ${a.athlete.firstName}`.trim().toLowerCase();
  const nameB = `${b.athlete.lastName} ${b.athlete.firstName}`.trim().toLowerCase();
  const nameCompare = nameA.localeCompare(nameB);
  if (nameCompare !== 0) return nameCompare;

  return a.id.localeCompare(b.id);
}

function stableSortEntries(entries: WeighInListEntry[]): WeighInListEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const compared = compareQueueEntries(a.entry, b.entry);
      if (compared !== 0) return compared;
      return a.index - b.index;
    })
    .map((item) => item.entry);
}

function buildGroupKey(entry: WeighInListEntry): string {
  if (entry.eventWeightCategory?.id) return `final:${entry.eventWeightCategory.id}`;
  if (entry.registeredEventWeightCategory?.id) {
    return `registered:${entry.registeredEventWeightCategory.id}`;
  }
  return `fallback:${entry.categoryCode}:${entry.categoryLabel ?? ''}`;
}

export function buildWeighInQueueGroups(entries: WeighInListEntry[]): WeighInQueueGroup[] {
  const groups = new Map<
    string,
    {
      group: WeighInQueueGroup;
      sort: GroupSortMeta;
    }
  >();

  for (const entry of entries) {
    const key = buildGroupKey(entry);
    const meta = getEntrySortMeta(entry);
    const existing = groups.get(key);
    if (existing) {
      existing.group.entries.push(entry);
      continue;
    }

    const ageGroup = entry.eventWeightCategory?.eventAgeGroup.rulesetAgeGroup;
    const sex = ageGroup?.sex ?? entry.athlete.sex ?? null;

    groups.set(key, {
      group: {
        key,
        heading: {
          categoryLabel: entry.categoryLabel ?? null,
          ageGroupName: ageGroup?.name ?? null,
          sex,
          weightLabel: getWeightLabel(entry),
        },
        entries: [entry],
      },
      sort: meta,
    });
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      const byDivisionPriority = a.sort.divisionPriority - b.sort.divisionPriority;
      if (byDivisionPriority !== 0) return byDivisionPriority;

      const weightA = a.sort.weightValue ?? NO_PARSED_WEIGHT_RANK;
      const weightB = b.sort.weightValue ?? NO_PARSED_WEIGHT_RANK;
      if (weightA !== weightB) return weightA - weightB;

      const fallbackByEntry = compareQueueEntries(a.group.entries[0], b.group.entries[0]);
      if (fallbackByEntry !== 0) return fallbackByEntry;

      if (a.sort.fallbackKey === b.sort.fallbackKey) return 0;
      return a.sort.fallbackKey < b.sort.fallbackKey ? -1 : 1;
    })
    .map((item) => ({
      ...item.group,
      entries: stableSortEntries(item.group.entries),
    }));
}

export function formatWeighInQueueGroupHeading(
  group: WeighInQueueGroup,
  labels: WeighInQueueHeadingLabels,
): string {
  const categoryLabel = group.heading.categoryLabel?.trim();
  if (categoryLabel) return categoryLabel;

  const ageGroupName = group.heading.ageGroupName?.trim() || labels.unknownAgeLabel;
  const divisionLabel =
    group.heading.sex === 'MALE'
      ? labels.maleDivisionLabel
      : group.heading.sex === 'FEMALE'
        ? labels.femaleDivisionLabel
        : labels.unknownDivisionLabel;
  const weightLabel = group.heading.weightLabel?.trim() || labels.unknownWeightLabel;

  return `${ageGroupName} ${divisionLabel} ${weightLabel}`.trim();
}
