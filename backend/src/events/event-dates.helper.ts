/**
 * Pure helpers for computing registration window status.
 * No dependencies — import freely from services and controllers.
 */

export type RegistrationWindowStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

type EventLike = {
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  lifecycle: string;
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
  if (!event.registrationOpensAt) {
    return event.lifecycle === 'REG_OPEN' ? 'OPEN' : 'CLOSED';
  }

  if (now < event.registrationOpensAt) return 'UPCOMING';

  if (event.registrationClosesAt && now >= event.registrationClosesAt)
    return 'CLOSED';

  return 'OPEN';
}

export function isRegistrationOpen(
  event: EventLike,
  now: Date = new Date(),
): boolean {
  return getRegistrationStatus(event, now) === 'OPEN';
}
