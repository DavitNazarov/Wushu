import type { CategoryTemplateGroupInput } from './category-template.builder';

function upperBound(value: number | null | undefined): number {
  return value == null ? Number.POSITIVE_INFINITY : value;
}

function validateWeightCategories(group: CategoryTemplateGroupInput): void {
  const sorted = [...group.weightCategories].sort(
    (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index];

    if (
      item.minWeightKgExcl != null &&
      item.maxWeightKgIncl != null &&
      item.maxWeightKgIncl <= item.minWeightKgExcl
    ) {
      throw new Error('INVALID_WEIGHT_RANGE');
    }

    if (item.maxWeightKgIncl == null && index !== sorted.length - 1) {
      throw new Error('OPEN_WEIGHT_CATEGORY_MUST_BE_LAST');
    }

    if (index === 0) continue;

    const previous = sorted[index - 1];
    if (
      upperBound(item.maxWeightKgIncl) <= upperBound(previous.maxWeightKgIncl)
    ) {
      throw new Error('WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING');
    }
  }
}

export function validateCategoryTemplateStructure(
  groups: CategoryTemplateGroupInput[],
): void {
  const codes = new Set<string>();
  const sortOrders = new Set<number>();

  for (const group of groups) {
    if (codes.has(group.code)) {
      throw new Error('DUPLICATE_AGE_GROUP_CODE');
    }
    codes.add(group.code);

    if (
      group.minAge != null &&
      group.maxAge != null &&
      group.maxAge < group.minAge
    ) {
      throw new Error('INVALID_AGE_RANGE');
    }

    const sortOrder = group.sortOrder ?? 0;
    if (sortOrder > 0 && sortOrders.has(sortOrder)) {
      throw new Error('DUPLICATE_AGE_GROUP_SORT_ORDER');
    }
    if (sortOrder > 0) {
      sortOrders.add(sortOrder);
    }

    validateWeightCategories(group);
  }
}
