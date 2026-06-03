import type { AthleteRow, ClubRow } from '@/types/api';

export function isGeorgianClub(club: ClubRow | null | undefined): boolean {
  if (!club) return false;
  const c = (club.country ?? '').trim().toLowerCase();
  return c === 'ge' || c === 'georgia';
}

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function getDuplicateCount(athlete: AthleteRow): number {
  return athlete.duplicateCount ?? athlete._dedupeCount ?? 0;
}

export function getInitials(athlete: AthleteRow): string {
  return `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase();
}

export function getPaginationPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export function formatDob(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale);
  } catch {
    return '—';
  }
}
