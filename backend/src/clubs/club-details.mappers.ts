import type { RegistrationStatus, WeighInStatus } from '@prisma/client';
import type { ClubDetailsAthleteLatestRegistration } from './club-details.types';

export const ACTIVE_REGISTRATION_STATUSES = new Set<RegistrationStatus>([
  'PENDING',
  'SUBMITTED',
  'APPROVED',
]);

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
      registration.registeredEventWeightCategory?.categoryTemplateWeight?.name ??
      null,
    status: registration.status,
    weighInStatus: registration.weighInStatus,
  };
}
