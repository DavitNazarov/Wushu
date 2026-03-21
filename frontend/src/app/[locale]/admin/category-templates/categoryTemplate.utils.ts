import type { CategoryTemplateStatus, CategoryTemplateType } from '@/types/api';

export function formatWeightLabel(min: number | null, max: number | null): string {
  if (max === null && min === null) return 'Open';
  if (max === null) return `> ${min}kg`;
  if (min === null) return `<= ${max}kg`;
  return `> ${min} - <= ${max}kg`;
}

export function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale);
}

export function categoryTemplateStatusKey(status: CategoryTemplateStatus) {
  return `status.${status.toLowerCase()}` as const;
}

export function categoryTemplateTypeKey(type: CategoryTemplateType) {
  return `type.${type.toLowerCase()}` as const;
}
