import { Injectable } from '@nestjs/common';
import type { Prisma, Registration, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { isRegistrationOpen } from '../events/event-dates.helper';

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
      },
      orderBy: [{ categoryCode: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(input: {
    organisationId: string;
    actorUserId: string;
    eventId: string;
    athleteId: string;
    categoryCode?: string;
    eventWeightCategoryId?: string | null;
    notes?: string | null;
    actorClubId?: string | null;
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

    // Coaches are subject to the online registration window. Admins (actorClubId == null/undefined) bypass.
    if (input.actorClubId != null && !isRegistrationOpen(event)) {
      throw new Error('REGISTRATION_CLOSED');
    }

    // Validate eventWeightCategoryId and derive categoryCode from it
    let categoryCode = input.categoryCode ?? '';
    const eventWeightCategoryId = input.eventWeightCategoryId ?? null;

    if (eventWeightCategoryId) {
      const ewc = await this.prisma.eventWeightCategory.findFirst({
        where: {
          id: eventWeightCategoryId,
          eventAgeGroup: { eventId: input.eventId },
        },
        include: { rulesetWeightCategory: true },
      });
      if (!ewc) throw new Error('INVALID_CATEGORY_FOR_EVENT');
      categoryCode = ewc.rulesetWeightCategory.name;
    } else if (!categoryCode) {
      throw new Error('CATEGORY_REQUIRED');
    }

    const registration = await this.prisma.registration.upsert({
      where: {
        eventId_athleteId: {
          eventId: input.eventId,
          athleteId: input.athleteId,
        },
      },
      create: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        athleteId: input.athleteId,
        clubId: athlete.clubId,
        categoryCode,
        eventWeightCategoryId,
        notes: input.notes ?? null,
        status: 'PENDING',
      },
      update: {
        categoryCode,
        eventWeightCategoryId,
        notes: input.notes ?? null,
      },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      action: 'REGISTRATION_UPSERTED',
      entityType: 'registration',
      entityId: registration.id,
      after: registration as unknown as Prisma.JsonValue,
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

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
    const isDirect = allowed.includes(input.newStatus);

    if (!isDirect) {
      if (!input.override) throw new Error('INVALID_STATUS_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
      // Coach cannot override
      if (input.actorClubId) throw new Error('COACH_CANNOT_OVERRIDE');
    }

    const updated = await this.prisma.registration.update({
      where: { id: input.registrationId },
      data: { status: input.newStatus },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: existing.eventId,
      actorUserId: input.actorUserId,
      action: 'REGISTRATION_STATUS_CHANGED',
      entityType: 'registration',
      entityId: input.registrationId,
      before: existing as unknown as Prisma.JsonValue,
      after: updated as unknown as Prisma.JsonValue,
      reason: input.reason ?? null,
      override: !isDirect,
    });

    return updated;
  }
}
