import { localizedFullName } from '@/lib/bilingual';
import type { RegistrationRow } from '@/types/api';

export const PAGE_SIZE = 10;
export const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function athleteInitials(reg: RegistrationRow): string {
  if (!reg.athlete) return '?';
  return `${reg.athlete.firstName[0]}${reg.athlete.lastName[0]}`.toUpperCase();
}

export function athleteName(reg: RegistrationRow, locale: string): string {
  if (!reg.athlete) return reg.athleteId;
  const year = reg.athlete.dateOfBirth ? ` (${new Date(reg.athlete.dateOfBirth).getFullYear()})` : '';
  return `${localizedFullName(reg.athlete.firstName, reg.athlete.lastName, reg.athlete.firstNameKa, reg.athlete.lastNameKa, locale)}${year}`;
}
