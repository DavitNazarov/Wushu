import type { AthleteSex } from '@prisma/client';

import { validateCategoryTemplateStructure } from './category-template-structure.validator';

type DefaultCategoryOptionSeed = {
  code: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

export type DefaultCategoryOptionGroupSeed = {
  code: string;
  name: string;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  options: DefaultCategoryOptionSeed[];
};

export type DefaultCategoryTemplateSeed = {
  name: string;
  optionGroupCodes: string[];
};

function buildWeightOptions(
  prefix: string,
  boundaries: number[],
  openTop = false,
): DefaultCategoryOptionSeed[] {
  const options: DefaultCategoryOptionSeed[] = [];

  for (let index = 0; index < boundaries.length; index += 1) {
    const upper = boundaries[index];
    const lower = index === 0 ? null : boundaries[index - 1];
    options.push({
      code: `${prefix}-${upper}`,
      name: `${upper}kg`,
      minWeightKgExcl: lower,
      maxWeightKgIncl: upper,
      sortOrder: index + 1,
    });
  }

  if (openTop) {
    const lower = boundaries.at(-1) ?? null;
    options.push({
      code: `${prefix}-open`,
      name: `+${lower}kg`,
      minWeightKgExcl: lower,
      maxWeightKgIncl: null,
      sortOrder: options.length + 1,
    });
  }

  return options;
}

function buildTemplateGroups() {
  return DEFAULT_CATEGORY_OPTION_GROUPS.map((group) => ({
    code: group.code,
    name: group.name,
    sex: group.sex,
    minAge: group.minAge,
    maxAge: group.maxAge,
    roundDurationSeconds: group.roundDurationSeconds,
    sortOrder: group.sortOrder,
    weightCategories: group.options.map((option) => ({
      code: option.code,
      name: option.name,
      minWeightKgExcl: option.minWeightKgExcl,
      maxWeightKgIncl: option.maxWeightKgIncl,
      sortOrder: option.sortOrder,
    })),
  }));
}

export function assertValidDefaultCategoryLibrary(): void {
  const optionCodes = new Set<string>();

  for (const group of DEFAULT_CATEGORY_OPTION_GROUPS) {
    for (const option of group.options) {
      if (optionCodes.has(option.code)) {
        throw new Error(`DUPLICATE_CATEGORY_OPTION_CODE:${option.code}`);
      }
      optionCodes.add(option.code);
    }
  }

  validateCategoryTemplateStructure(buildTemplateGroups());
}

// ASSUMPTION: these seeded defaults are a sensible reusable IWUF-style
// baseline until the federation publishes an official shared library.
export const DEFAULT_CATEGORY_OPTION_GROUPS: DefaultCategoryOptionGroupSeed[] =
  [
    {
      code: 'children-boys-sanda',
      name: 'Children Boys Sanda',
      sex: 'MALE',
      minAge: 9,
      maxAge: 11,
      roundDurationSeconds: 90,
      sortOrder: 1,
      options: buildWeightOptions(
        'children-boys-sanda',
        [24, 27, 30, 33, 36, 39, 42, 45, 48, 52, 56],
        true,
      ),
    },
    {
      code: 'children-girls-sanda',
      name: 'Children Girls Sanda',
      sex: 'FEMALE',
      minAge: 9,
      maxAge: 11,
      roundDurationSeconds: 90,
      sortOrder: 2,
      options: buildWeightOptions(
        'children-girls-sanda',
        [24, 27, 30, 33, 36, 39, 42, 45, 48, 52],
        true,
      ),
    },
    {
      code: 'junior-boys-sanda',
      name: 'Junior Boys Sanda',
      sex: 'MALE',
      minAge: 12,
      maxAge: 14,
      roundDurationSeconds: 120,
      sortOrder: 3,
      options: buildWeightOptions(
        'junior-boys-sanda',
        [42, 45, 48, 52, 56, 60, 65, 70, 75, 80],
        true,
      ),
    },
    {
      code: 'junior-girls-sanda',
      name: 'Junior Girls Sanda',
      sex: 'FEMALE',
      minAge: 12,
      maxAge: 14,
      roundDurationSeconds: 120,
      sortOrder: 4,
      options: buildWeightOptions(
        'junior-girls-sanda',
        [39, 42, 45, 48, 52, 56, 60, 65, 70],
        true,
      ),
    },
    {
      code: 'youth-boys-sanda',
      name: 'Youth Boys Sanda',
      sex: 'MALE',
      minAge: 15,
      maxAge: 17,
      roundDurationSeconds: 120,
      sortOrder: 5,
      options: buildWeightOptions(
        'youth-boys-sanda',
        [48, 52, 56, 60, 65, 70, 75, 80, 85, 90],
        true,
      ),
    },
    {
      code: 'youth-girls-sanda',
      name: 'Youth Girls Sanda',
      sex: 'FEMALE',
      minAge: 15,
      maxAge: 17,
      roundDurationSeconds: 120,
      sortOrder: 6,
      options: buildWeightOptions(
        'youth-girls-sanda',
        [45, 48, 52, 56, 60, 65, 70, 75],
        true,
      ),
    },
    {
      code: 'adults-men-sanda',
      name: 'Adults Men Sanda',
      sex: 'MALE',
      minAge: 18,
      maxAge: 40,
      roundDurationSeconds: 120,
      sortOrder: 7,
      options: buildWeightOptions(
        'adults-men-sanda',
        [48, 52, 56, 60, 65, 70, 75, 80, 85, 90, 100],
        true,
      ),
    },
    {
      code: 'adults-women-sanda',
      name: 'Adults Women Sanda',
      sex: 'FEMALE',
      minAge: 18,
      maxAge: 40,
      roundDurationSeconds: 120,
      sortOrder: 8,
      options: buildWeightOptions(
        'adults-women-sanda',
        [45, 48, 52, 56, 60, 65, 70, 75],
        true,
      ),
    },
  ];

export const DEFAULT_CATEGORY_TEMPLATE_SEEDS: DefaultCategoryTemplateSeed[] = [
  {
    name: 'Children Sanda',
    optionGroupCodes: ['children-boys-sanda', 'children-girls-sanda'],
  },
  {
    name: 'Junior Sanda',
    optionGroupCodes: ['junior-boys-sanda', 'junior-girls-sanda'],
  },
  {
    name: 'Youth Sanda',
    optionGroupCodes: ['youth-boys-sanda', 'youth-girls-sanda'],
  },
  {
    name: 'Adults Sanda',
    optionGroupCodes: ['adults-men-sanda', 'adults-women-sanda'],
  },
  {
    name: 'Default Sanda Library',
    optionGroupCodes: DEFAULT_CATEGORY_OPTION_GROUPS.map((group) => group.code),
  },
];
