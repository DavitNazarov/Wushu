import type {
  WeighInCategory,
  WeighInEventAgeGroupRef,
  WeighInListEntry,
  WeighInWeightCategoryRef,
  WeighInWeightDefinition,
} from '@/types/weighin';

export function getResolvedWeightDefinition(
  category: WeighInWeightCategoryRef | null | undefined,
): WeighInWeightDefinition | null {
  return category?.categoryTemplateWeight ?? category?.rulesetWeightCategory ?? null;
}

export function getResolvedAgeGroup(
  ageGroup: WeighInEventAgeGroupRef | null | undefined,
) {
  return ageGroup?.categoryTemplateAgeGroup ?? ageGroup?.rulesetAgeGroup ?? null;
}

export function toWeighInCategoryList(entry: WeighInListEntry | null): WeighInCategory[] {
  if (!entry?.eventWeightCategory) return [];

  return entry.eventWeightCategory.eventAgeGroup.weightCategories
    .map((item) => {
      const definition = getResolvedWeightDefinition(item);
      if (!definition) return null;

      return {
        id: item.id,
        name: definition.name,
        minWeightKgExcl: definition.minWeightKgExcl,
        maxWeightKgIncl: definition.maxWeightKgIncl,
        sortOrder: definition.sortOrder ?? 0,
      };
    })
    .filter((item): item is WeighInCategory => item != null);
}
