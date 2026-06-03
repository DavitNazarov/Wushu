import type { RegistrationStatus, WeighInStatus } from '@prisma/client';
import type { ClubDetailsAthleteLatestRegistration } from './club-details.types';

// "Active" = the registration is still in play (not rejected or withdrawn).
// Used both to flag athletes as having an active commitment and to count the
// activeRegistrations stat shown in the club overview panel.
export const ACTIVE_REGISTRATION_STATUSES = new Set<RegistrationStatus>([
  'PENDING',
  'SUBMITTED',
  'APPROVED',
]);

// Pure mapper: take the most recent Registration row (with the joins the
// service performs) and flatten it into the UI-friendly summary shape.
// Returns null when there is no registration at all. Kept pure (no Prisma
// access) so it can be unit-tested without DB mocks.
export function toLatestRegistration(
  registration:
    | {
        categoryCode: string;
        status: RegistrationStatus;
        weighInStatus: WeighInStatus;
        event: {
          id: string;
          name: string;
          slug: string;
          competitionStartDate: Date;
        };
        eventWeightCategory: {
          categoryTemplateWeight: { name: string } | null;
          eventAgeGroup: {
            categoryTemplateAgeGroup: { name: string } | null;
          } | null;
        } | null;
        registeredEventWeightCategory: {
          categoryTemplateWeight: { name: string } | null;
        } | null;
      }
    | undefined,
): ClubDetailsAthleteLatestRegistration | null {
  if (!registration) return null;

  return {
    eventId: registration.event.id,
    eventName: registration.event.name,
    eventSlug: registration.event.slug,
    competitionStartDate: registration.event.competitionStartDate.toISOString(),
    categoryCode: registration.categoryCode,
    ageGroupName:
      registration.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
        ?.name ?? null,
    finalWeightCategoryName:
      registration.eventWeightCategory?.categoryTemplateWeight?.name ?? null,
    initialWeightCategoryName:
      registration.registeredEventWeightCategory?.categoryTemplateWeight
        ?.name ?? null,
    status: registration.status,
    weighInStatus: registration.weighInStatus,
  };
}
