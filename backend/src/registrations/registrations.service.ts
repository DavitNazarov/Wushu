import { Injectable } from '@nestjs/common';
import type {
  Athlete,
  Event,
  Prisma,
  Registration,
  RegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { isRegistrationOpen } from '../events/event-dates.helper';
import {
  isEventReadOnly,
  isRegistrationMutableLifecycle,
} from '../events/lifecycle-rules';

const ALLOWED_STATUS_TRANSITIONS: Record<
  RegistrationStatus,
  RegistrationStatus[]
> = {
  PENDING: ['SUBMITTED', 'WITHDRAWN', 'APPROVED', 'REJECTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['WITHDRAWN', 'REJECTED'], // admin can change mind and reject
  REJECTED: ['SUBMITTED', 'APPROVED', 'WITHDRAWN'], // admin can reverse rejection
  WITHDRAWN: [],
};

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertEventAllowsRegistrationChanges(
    event: Event,
    input: {
      actorClubId?: string | null;
      override?: boolean;
      reason?: string | null;
    },
  ): void {
    const isCoach = input.actorClubId != null;
    const override = input.override ?? false;
    const reason = input.reason ?? null;

    if (isCoach) {
      if (event.lifecycle !== 'REG_OPEN' || !isRegistrationOpen(event)) {
        throw new Error('REGISTRATION_CLOSED');
      }
      return;
    }

    const mutable = isRegistrationMutableLifecycle(event.lifecycle);
    const readOnly = isEventReadOnly(event.lifecycle);

    if ((readOnly || !mutable) && !override) {
      throw new Error(readOnly ? 'EVENT_READ_ONLY' : 'REGISTRATION_LOCKED');
    }

    if ((readOnly || !mutable || override) && !reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }
  }

  private computeAgeOnDate(dateOfBirth: Date, onDate: Date): number {
    let age = onDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDiff = onDate.getUTCMonth() - dateOfBirth.getUTCMonth();
    const dayDiff = onDate.getUTCDate() - dateOfBirth.getUTCDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    return age;
  }

  private assertAthleteEligibleForCategory(
    athlete: Athlete,
    event: Event,
    category: {
      eventAgeGroup: {
        categoryTemplateAgeGroup: {
          minAge: number | null;
          maxAge: number | null;
          sex: Athlete['sex'];
        };
      };
    },
  ): void {
    const ageGroup = category.eventAgeGroup.categoryTemplateAgeGroup;
    const athleteAge = this.computeAgeOnDate(
      athlete.dateOfBirth,
      event.competitionStartDate,
    );

    // Special rule: athletes aged 15–17 may participate in the 18+ adult group
    const isYouthToAdultException =
      athleteAge >= 15 && athleteAge <= 17 && ageGroup.minAge === 18;

    if (ageGroup.minAge != null && athleteAge < ageGroup.minAge && !isYouthToAdultException) {
      throw new Error('ATHLETE_OUT_OF_AGE_GROUP');
    }
    if (ageGroup.maxAge != null && athleteAge > ageGroup.maxAge) {
      throw new Error('ATHLETE_OUT_OF_AGE_GROUP');
    }

    if (ageGroup.sex && athlete.sex && ageGroup.sex !== athlete.sex) {
      throw new Error('ATHLETE_SEX_MISMATCH_FOR_CATEGORY');
    }
  }

  private async resolveEventCategoryForRegistration(input: {
    organisationId: string;
    eventId: string;
    eventWeightCategoryId?: string | null;
    athlete: Athlete;
    event: Event;
    skipEligibilityCheck?: boolean;
  }): Promise<{ eventWeightCategoryId: string | null; categoryCode: string }> {
    const hasConfiguredCategories = await this.prisma.eventWeightCategory.count({
      where: {
        eventAgeGroup: { eventId: input.eventId },
      },
    });

    if (hasConfiguredCategories === 0) {
      throw new Error('EVENT_CATEGORIES_NOT_CONFIGURED');
    }

    const eventWeightCategoryId = input.eventWeightCategoryId ?? null;
    if (eventWeightCategoryId) {
      const category = await this.prisma.eventWeightCategory.findFirst({
        where: {
          id: eventWeightCategoryId,
          eventAgeGroup: { eventId: input.eventId },
        },
        include: {
          categoryTemplateWeight: true,
          eventAgeGroup: {
            include: { categoryTemplateAgeGroup: true },
          },
        },
      });
      if (!category) throw new Error('INVALID_CATEGORY_FOR_EVENT');

      if (!input.skipEligibilityCheck) {
        this.assertAthleteEligibleForCategory(input.athlete, input.event, category);
      }
      return {
        eventWeightCategoryId: category.id,
        categoryCode: category.categoryTemplateWeight.name,
      };
    }

    throw new Error('EVENT_WEIGHT_CATEGORY_REQUIRED');
  }

  async list(params: {
    organisationId: string;
    eventId?: string;
    clubId?: string;
    status?: RegistrationStatus;
    q?: string;
    categoryCode?: string;
    actorClubId?: string | null;
  }) {
    const where: Prisma.RegistrationWhereInput = {
      organisationId: params.organisationId,
    };

    if (params.eventId) where.eventId = params.eventId;
    if (params.status) where.status = params.status;

    const effectiveClubId = params.actorClubId ?? params.clubId;
    if (effectiveClubId) where.clubId = effectiveClubId;
    else if (params.clubId) where.clubId = params.clubId;

    if (params.categoryCode) where.categoryCode = params.categoryCode;

    if (params.q) {
      where.athlete = {
        OR: [
          { firstName: { contains: params.q, mode: 'insensitive' } },
          { lastName: { contains: params.q, mode: 'insensitive' } },
        ],
      };
    }

    return this.prisma.registration.findMany({
      where,
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
        club: { select: { id: true, name: true } },
        eventWeightCategory: {
          include: {
            categoryTemplateWeight: {
              select: { name: true, minWeightKgExcl: true, maxWeightKgIncl: true },
            },
            eventAgeGroup: {
              include: {
                categoryTemplateAgeGroup: {
                  select: { id: true, name: true, minAge: true, maxAge: true, sex: true },
                },
              },
            },
          },
        },
        registeredEventWeightCategory: {
          include: {
            categoryTemplateWeight: {
              select: { name: true, minWeightKgExcl: true, maxWeightKgIncl: true },
            },
          },
        },
      },
      orderBy: [{ categoryCode: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(input: {
    organisationId: string;
    actorUserId: string;
    eventId: string;
    athleteId: string;
    eventWeightCategoryId?: string | null;
    notes?: string | null;
    actorClubId?: string | null;
    override?: boolean;
    reason?: string | null;
  }): Promise<Registration> {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: input.athleteId, organisationId: input.organisationId },
    });
    if (!athlete) throw new Error('ATHLETE_NOT_FOUND');

    if (input.actorClubId && athlete.clubId !== input.actorClubId) {
      throw new Error('ATHLETE_NOT_IN_COACH_CLUB');
    }

    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertEventAllowsRegistrationChanges(event, {
      actorClubId: input.actorClubId,
      override: input.override,
      reason: input.reason ?? null,
    });

    const existing = await this.prisma.registration.findFirst({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        athleteId: input.athleteId,
      },
    });
    if (existing) throw new Error('REGISTRATION_ALREADY_EXISTS');

    const resolvedCategory = await this.resolveEventCategoryForRegistration({
      organisationId: input.organisationId,
      eventId: input.eventId,
      eventWeightCategoryId: input.eventWeightCategoryId ?? null,
      athlete,
      event,
    });

    const registration = await this.prisma.registration.create({
      data: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        athleteId: input.athleteId,
        clubId: athlete.clubId,
        categoryCode: resolvedCategory.categoryCode,
        eventWeightCategoryId: resolvedCategory.eventWeightCategoryId,
        registeredEventWeightCategoryId: resolvedCategory.eventWeightCategoryId,
        notes: input.notes ?? null,
        status: 'PENDING',
        weighInStatus: 'NOT_WEIGHED',
      },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      action: 'REGISTRATION_CREATED',
      entityType: 'registration',
      entityId: registration.id,
      before: null,
      after: registration as unknown as Prisma.JsonValue,
      reason: input.reason ?? null,
      override: input.override ?? false,
    });

    return registration;
  }

  async setStatus(input: {
    organisationId: string;
    registrationId: string;
    actorUserId: string;
    newStatus: RegistrationStatus;
    override?: boolean;
    reason?: string | null;
    actorClubId?: string | null;
  }): Promise<Registration> {
    const existing = await this.prisma.registration.findFirst({
      where: { id: input.registrationId, organisationId: input.organisationId },
      include: { event: true },
    });
    if (!existing) throw new Error('REGISTRATION_NOT_FOUND');

    // Coach can only change registrations for their own club
    if (input.actorClubId && existing.clubId !== input.actorClubId) {
      throw new Error('REGISTRATION_NOT_IN_COACH_CLUB');
    }

    // Coach cannot use override (APPROVED/REJECTED are admin-only)
    const coachAllowedStatuses: RegistrationStatus[] = [
      'SUBMITTED',
      'WITHDRAWN',
    ];
    if (input.actorClubId && !coachAllowedStatuses.includes(input.newStatus)) {
      throw new Error('COACH_CANNOT_SET_STATUS');
    }

    if (input.actorClubId && !isRegistrationMutableLifecycle(existing.event.lifecycle)) {
      throw new Error('REGISTRATION_LOCKED');
    }
    if (isEventReadOnly(existing.event.lifecycle) && !input.override) {
      throw new Error('EVENT_READ_ONLY');
    }
    if (!isRegistrationMutableLifecycle(existing.event.lifecycle) && !input.override) {
      throw new Error('REGISTRATION_LOCKED');
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
    const isDirect = allowed.includes(input.newStatus);

    if (!isRegistrationMutableLifecycle(existing.event.lifecycle) && input.actorClubId) {
      throw new Error('COACH_CANNOT_OVERRIDE');
    }

    if (!isDirect) {
      if (!input.override) throw new Error('INVALID_STATUS_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
      // Coach cannot override
      if (input.actorClubId) throw new Error('COACH_CANNOT_OVERRIDE');
    }

    if (
      !isRegistrationMutableLifecycle(existing.event.lifecycle) &&
      !input.reason
    ) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const updated = await this.prisma.registration.update({
      where: { id: input.registrationId },
      data: { status: input.newStatus },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: existing.event.id,
      actorUserId: input.actorUserId,
      action: 'REGISTRATION_STATUS_CHANGED',
      entityType: 'registration',
      entityId: input.registrationId,
      before: {
        id: existing.id,
        status: existing.status,
      } as unknown as Prisma.JsonValue,
      after: updated as unknown as Prisma.JsonValue,
      reason: input.reason ?? null,
      override:
        !isDirect || !isRegistrationMutableLifecycle(existing.event.lifecycle),
    });

    return updated;
  }

  async setCategory(input: {
    organisationId: string;
    registrationId: string;
    eventWeightCategoryId: string;
    actorUserId: string;
    actorClubId?: string | null;
    override?: boolean;
    reason?: string | null;
  }): Promise<Registration> {
    const existing = await this.prisma.registration.findFirst({
      where: {
        id: input.registrationId,
        organisationId: input.organisationId,
      },
      include: {
        event: true,
        athlete: true,
      },
    });
    if (!existing) throw new Error('REGISTRATION_NOT_FOUND');

    if (input.actorClubId && existing.clubId !== input.actorClubId) {
      throw new Error('REGISTRATION_NOT_IN_COACH_CLUB');
    }
    if (input.actorClubId) {
      throw new Error('COACH_CANNOT_SET_CATEGORY');
    }

    const lifecycleMutable = isRegistrationMutableLifecycle(
      existing.event.lifecycle,
    );
    const requiresOverride = !lifecycleMutable || isEventReadOnly(existing.event.lifecycle);
    if (requiresOverride && !input.override) {
      throw new Error(
        isEventReadOnly(existing.event.lifecycle)
          ? 'EVENT_READ_ONLY'
          : 'REGISTRATION_LOCKED',
      );
    }
    if ((requiresOverride || input.override) && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const resolvedCategory = await this.resolveEventCategoryForRegistration({
      organisationId: input.organisationId,
      eventId: existing.eventId,
      eventWeightCategoryId: input.eventWeightCategoryId,
      athlete: existing.athlete,
      event: existing.event,
      skipEligibilityCheck: input.override ?? false,
    });

    const updated = await this.prisma.registration.update({
      where: { id: existing.id },
      data: {
        categoryCode: resolvedCategory.categoryCode,
        eventWeightCategoryId: resolvedCategory.eventWeightCategoryId,
        registeredEventWeightCategoryId: requiresOverride
          ? existing.registeredEventWeightCategoryId ?? existing.eventWeightCategoryId
          : resolvedCategory.eventWeightCategoryId,
        weighInStatus: lifecycleMutable ? 'NOT_WEIGHED' : existing.weighInStatus,
      },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: existing.eventId,
      actorUserId: input.actorUserId,
      action: requiresOverride
        ? 'REGISTRATION_CATEGORY_OVERRIDE'
        : 'REGISTRATION_CATEGORY_UPDATED',
      entityType: 'registration',
      entityId: existing.id,
      before: existing as unknown as Prisma.JsonValue,
      after: updated as unknown as Prisma.JsonValue,
      reason: input.reason ?? null,
      override: requiresOverride || (input.override ?? false),
    });

    return updated;
  }
}
