import type { RegistrationStatus } from '@/types/api';
import type { ClubDetailsAthleteLatestRegistration } from '@/types/clubs';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

export function formatClubDate(
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatClubLocation(
  city: string | null | undefined,
  country: string | null | undefined,
  fallback: string,
): string {
  return [city, country].filter(Boolean).join(', ') || fallback;
}

export function latestDivisionLabel(
  registration: ClubDetailsAthleteLatestRegistration | null,
  fallback: string,
): string {
  if (!registration) return fallback;

  const weightLabel =
    registration.finalWeightCategoryName ??
    registration.initialWeightCategoryName ??
    registration.categoryCode;

  return [registration.ageGroupName, weightLabel].filter(Boolean).join(' · ');
}

export function registrationStatusVariant(
  status: RegistrationStatus,
): BadgeVariant {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'SUBMITTED') return 'warning';
  return 'default';
}

export function splitCategoryCodes(categoryCodes: string[], visibleCount = 2) {
  return {
    visible: categoryCodes.slice(0, visibleCount),
    hiddenCount: Math.max(categoryCodes.length - visibleCount, 0),
  };
}
