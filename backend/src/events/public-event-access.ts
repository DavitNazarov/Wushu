import type { Event } from '@prisma/client';
import { getRegistrationStatus } from './event-dates.helper';

type EventPublicAccessFields = Pick<
  Event,
  'published' | 'registrationOpensAt' | 'registrationClosesAt' | 'lifecycle'
>;

export function canDiscoverEventPublicly(
  event: EventPublicAccessFields,
  now: Date = new Date(),
): boolean {
  if (event.published) {
    return true;
  }

  const registrationStatus = getRegistrationStatus(event, now);
  return (
    registrationStatus === 'OPEN' || registrationStatus === 'UPCOMING'
  );
}

export function canViewCompetitionDataPublicly(
  event: Pick<Event, 'published'>,
): boolean {
  return event.published;
}
