import type { AthleteSex, CategoryOption, CategoryOptionGroup } from '@prisma/client';

export type CategoryTemplateWeightInput = {
  code: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

export type CategoryTemplateGroupInput = {
  code: string;
  name: string;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  weightCategories: CategoryTemplateWeightInput[];
};

type CategoryOptionWithGroup = CategoryOption & {
  group: CategoryOptionGroup;
};

export function buildCategoryTemplateStructure(
  options: CategoryOptionWithGroup[],
): CategoryTemplateGroupInput[] {
  const groups = new Map<string, CategoryTemplateGroupInput>();

  for (const option of options) {
    const groupKey = option.group.id;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.weightCategories.push({
        code: option.code,
        name: option.name,
        minWeightKgExcl: option.minWeightKgExcl,
        maxWeightKgIncl: option.maxWeightKgIncl,
        sortOrder: option.sortOrder,
      });
      continue;
    }

    groups.set(groupKey, {
      code: option.group.code,
      name: option.group.name,
      sex: option.group.sex,
      minAge: option.group.minAge,
      maxAge: option.group.maxAge,
      roundDurationSeconds: option.group.roundDurationSeconds,
      sortOrder: option.group.sortOrder,
      weightCategories: [
        {
          code: option.code,
          name: option.name,
          minWeightKgExcl: option.minWeightKgExcl,
          maxWeightKgIncl: option.maxWeightKgIncl,
          sortOrder: option.sortOrder,
        },
      ],
    });
  }

  return [...groups.values()]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((group) => ({
      ...group,
      weightCategories: [...group.weightCategories].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    }));
}
