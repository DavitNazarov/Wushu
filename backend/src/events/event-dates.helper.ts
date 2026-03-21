import { formatInTimeZone } from 'date-fns-tz';

/**
 * Pure helpers for computing registration window status.
 * No dependencies — import freely from services and controllers.
 */

export type RegistrationWindowStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

type EventLike = {
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  lifecycle: string;
  timezone?: string | null;
};

/**
 * Compute registration window status for the given event at the given instant.
 *
 * Fallback for legacy events (registrationOpensAt is NULL):
 *   – lifecycle REG_OPEN → OPEN
 *   – anything else → CLOSED
 */
export function getRegistrationStatus(
  event: EventLike,
  now: Date = new Date(),
): RegistrationWindowStatus {
  const timezone = event.timezone || 'Asia/Tbilisi';

  if (!event.registrationOpensAt) {
    return event.lifecycle === 'REG_OPEN' ? 'OPEN' : 'CLOSED';
  }

  const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const opensOn = formatInTimeZone(
    event.registrationOpensAt,
    timezone,
    'yyyy-MM-dd',
  );

  if (today < opensOn) return 'UPCOMING';

  if (event.registrationClosesAt) {
    const closesOn = formatInTimeZone(
      event.registrationClosesAt,
      timezone,
      'yyyy-MM-dd',
    );
    if (today > closesOn) return 'CLOSED';
  }

  return 'OPEN';
}

export function isRegistrationOpen(
  event: EventLike,
  now: Date = new Date(),
): boolean {
  return getRegistrationStatus(event, now) === 'OPEN';
}
