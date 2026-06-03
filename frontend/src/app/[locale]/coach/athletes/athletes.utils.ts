import type { AthleteRow } from '@/types/api';

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function formatDob(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString(locale); } catch { return '—'; }
}

export function getInitials(a: AthleteRow): string {
  return `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`.toUpperCase();
}
