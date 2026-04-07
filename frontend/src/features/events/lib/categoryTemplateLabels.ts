type TranslateFn = (
  key: string,
  values?: Record<string, number | string>,
) => string;

export function formatWeightCategoryLabel(
  min: number | null,
  max: number | null,
  t: TranslateFn,
): string {
  if (max === null && min === null) return t('openDivision');
  if (max === null) return t('weightMinOnly', { min: min! });
  if (min === null) return t('weightMaxOnly', { max });
  return t('weightRange', { min, max });
}

export function formatAgeGroupLabel(
  minAge: number | null,
  maxAge: number | null,
  t: TranslateFn,
): string {
  if (minAge === null) return t('ageOpen');
  if (maxAge === null) return t('ageMinOnly', { min: minAge });
  return t('ageRange', { min: minAge, max: maxAge });
}

export function formatRoundDurationLabel(
  roundDurationSeconds: number,
  t: TranslateFn,
): string {
  return t('roundDurationMinutes', { minutes: roundDurationSeconds / 60 });
}
