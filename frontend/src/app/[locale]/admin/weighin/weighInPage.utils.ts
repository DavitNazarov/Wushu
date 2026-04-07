import { toWeighInCategoryList } from '@/lib/weighin/category';
import type { WeighInListEntry } from '@/types/weighin';

export function normalizeWeight(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

export function toWeighInCategories(entry: WeighInListEntry | null) {
  return toWeighInCategoryList(entry);
}
