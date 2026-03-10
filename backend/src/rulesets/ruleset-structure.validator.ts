import type { RulesetAgeGroupInput } from './ruleset.schemas';

function upperBound(value: number | null | undefined): number {
  return value == null ? Number.POSITIVE_INFINITY : value;
}

function validateWeightCategories(ageGroup: RulesetAgeGroupInput): void {
  const sorted = [...ageGroup.weightCategories].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];

    if (
      item.minWeightKgExcl != null &&
      item.maxWeightKgIncl != null &&
      item.maxWeightKgIncl <= item.minWeightKgExcl
    ) {
      throw new Error('INVALID_WEIGHT_RANGE');
    }

    if (item.maxWeightKgIncl == null && i !== sorted.length - 1) {
      throw new Error('OPEN_WEIGHT_CATEGORY_MUST_BE_LAST');
    }

    if (i > 0) {
      const previous = sorted[i - 1];
      if (upperBound(item.maxWeightKgIncl) <= upperBound(previous.maxWeightKgIncl)) {
        throw new Error('WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING');
      }
    }
  }
}

export function validateRulesetStructure(ageGroups: RulesetAgeGroupInput[]): void {
  const codes = new Set<string>();
  const sortOrders = new Set<number>();

  for (const ageGroup of ageGroups) {
    if (codes.has(ageGroup.code)) {
      throw new Error('DUPLICATE_AGE_GROUP_CODE');
    }
    codes.add(ageGroup.code);

    if (
      ageGroup.minAge != null &&
      ageGroup.maxAge != null &&
      ageGroup.maxAge < ageGroup.minAge
    ) {
      throw new Error('INVALID_AGE_RANGE');
    }

    const sortOrder = ageGroup.sortOrder ?? 0;
    if (sortOrder > 0 && sortOrders.has(sortOrder)) {
      throw new Error('DUPLICATE_AGE_GROUP_SORT_ORDER');
    }
    if (sortOrder > 0) {
      sortOrders.add(sortOrder);
    }

    validateWeightCategories(ageGroup);
  }
}
