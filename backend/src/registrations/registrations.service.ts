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

// State-machine table for the Registration.status enum. Any transition NOT
// listed here requires admin override (with a reason) — direct transitions
// fall through to a normal write, indirect ones force OVERRIDE_REASON_REQUIRED.
// WITHDRAWN is terminal: there's no way out except via override.
export const ALLOWED_STATUS_TRANSITIONS: Record<
  RegistrationStatus,
  RegistrationStatus[]
> = {
  PENDING: ['SUBMITTED', 'WITHDRAWN', 'APPROVED', 'REJECTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['WITHDRAWN', 'REJECTED'], // admin can change mind and reject
  REJECTED: ['SUBMITTED', 'APPROVED', 'WITHDRAWN'], // admin can reverse rejection
  WITHDRAWN: [],
};

// Registration aggregate logic — creation, status changes, category moves.
// Bulk operations live in RegistrationBulkStatusService to keep this class
// focused on per-row logic.
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Shared write-guard for any mutation tied to an event. Coaches MUST be
  // inside the registration window (lifecycle=REG_OPEN AND the date range
  // is currently open). Admins can mutate at almost any lifecycle but need
  // `override=true` + `reason` once the event leaves the mutable phases.
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

  // Age as of `onDate`. All in UTC so we don't get off-by-one near midnight
  // in the event timezone. Standard "have they had their birthday this year"
  // logic (subtract 1 if month/day hasn't reached the DOB yet).
  private computeAgeOnDate(dateOfBirth: Date, onDate: Date): number {
    let age = onDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDiff = onDate.getUTCMonth() - dateOfBirth.getUTCMonth();
    const dayDiff = onDate.getUTCDate() - dateOfBirth.getUTCDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    return age;
  }

  // Eligibility gate for "is this athlete allowed in this category?"
  // Combines an age window (with the federation's youth→adult exception:
  // 15–17 year olds may compete in 18+ groups) and a sex match. Throws
  // ATHLETE_OUT_OF_AGE_GROUP or ATHLETE_SEX_MISMATCH_FOR_CATEGORY; the
  // controller maps both to 400.
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

    if (
      ageGroup.minAge != null &&
      athleteAge < ageGroup.minAge &&
      !isYouthToAdultException
    ) {
      throw new Error('ATHLETE_OUT_OF_AGE_GROUP');
    }
    if (ageGroup.maxAge != null && athleteAge > ageGroup.maxAge) {
      throw new Error('ATHLETE_OUT_OF_AGE_GROUP');
    }

    if (ageGroup.sex && athlete.sex && ageGroup.sex !== athlete.sex) {
      throw new Error('ATHLETE_SEX_MISMATCH_FOR_CATEGORY');
    }
  }

  // Resolve and validate the event-scoped weight category for a registration.
  // Order of failures (each throws a distinct code):
  //   EVENT_CATEGORIES_NOT_CONFIGURED — admin hasn't picked categories yet
  //   EVENT_WEIGHT_CATEGORY_REQUIRED  — caller didn't provide an id
  //   INVALID_CATEGORY_FOR_EVENT      — id doesn't belong to this event
  //   ATHLETE_OUT_OF_AGE_GROUP / _SEX_MISMATCH_FOR_CATEGORY (via eligibility)
  // skipEligibilityCheck is true on admin overrides where the rule is being
  // intentionally bypassed (must already be authorized by the caller).
  private async resolveEventCategoryForRegistration(input: {
    organisationId: string;
    eventId: string;
    eventWeightCategoryId?: string | null;
    athlete: Athlete;
    event: Event;
    skipEligibilityCheck?: boolean;
  }): Promise<{ eventWeightCategoryId: string | null; categoryCode: string }> {
    const hasConfiguredCategories = await this.prisma.eventWeightCategory.count(
      {
        where: {
          eventAgeGroup: { eventId: input.eventId },
        },
      },
    );

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
        this.assertAthleteEligibleForCategory(
          input.athlete,
          input.event,
          category,
        );
      }
      return {
        eventWeightCategoryId: category.id,
        categoryCode: category.categoryTemplateWeight.name,
      };
    }

    throw new Error('EVENT_WEIGHT_CATEGORY_REQUIRED');
  }

  // Filtered registration list. `actorClubId` (set when the caller is a
  // coach) takes precedence over the requested clubId — coaches see only
  // their own club's data, even if they manually URL-edit the filter.
  // `q` matches firstName OR lastName case-insensitively. Joins athlete +
  // club + both eventWeightCategory relations so the UI can show full
  // category names plus "initial weight class" badges in one fetch.
  async list(params: {
    organisationId: string;
    eventId?: string;
    clubId?: string;
    status?: RegistrationStatus;
    q?: string;
    categoryCode?: string;
    actorClubId?: string | null;
    limit?: number;
    offset?: number;
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
      // Match both EN and KA name fields so a Georgian-language search hits the
      // bilingual names too (athletes registered with KA-only display names).
      where.athlete = {
        OR: [
          { firstName: { contains: params.q, mode: 'insensitive' } },
          { lastName: { contains: params.q, mode: 'insensitive' } },
          { firstNameKa: { contains: params.q, mode: 'insensitive' } },
          { lastNameKa: { contains: params.q, mode: 'insensitive' } },
        ],
      };
    }

    // Server-side pagination: `total` is the full filtered count (ignores
    // take/skip) so the client can render page controls without pulling every
    // row. Both queries share the same `where`.
    const [rows, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              firstNameKa: true,
              lastNameKa: true,
              dateOfBirth: true,
            },
          },
          club: { select: { id: true, name: true } },
          eventWeightCategory: {
            include: {
              categoryTemplateWeight: {
                select: {
                  name: true,
                  minWeightKgExcl: true,
                  maxWeightKgIncl: true,
                },
              },
              eventAgeGroup: {
                include: {
                  categoryTemplateAgeGroup: {
                    select: {
                      id: true,
                      name: true,
                      minAge: true,
                      maxAge: true,
                      sex: true,
                    },
                  },
                },
              },
            },
          },
          registeredEventWeightCategory: {
            include: {
              categoryTemplateWeight: {
                select: {
                  name: true,
                  minWeightKgExcl: true,
                  maxWeightKgIncl: true,
                },
              },
            },
          },
        },
        orderBy: [{ categoryCode: 'asc' }, { createdAt: 'asc' }],
        // Hard row cap: one national-event registration list fits comfortably,
        // but an unbounded org-wide query must not pull every season through
        // Node. Clients can page with limit/offset.
        take: Math.min(Math.max(params.limit ?? 1000, 1), 1000),
        skip: Math.max(params.offset ?? 0, 0),
      }),
      this.prisma.registration.count({ where }),
    ]);

    return { rows, total };
  }

  // Distinct categoryCode values for an event's registrations, used to populate
  // the admin Category filter dropdown independently of pagination (the paged
  // list only ever holds one page of rows). Tenant- + coach-scoped exactly like
  // list(): a coach only ever sees their own club's category codes.
  async listCategoryCodes(params: {
    organisationId: string;
    eventId: string;
    clubId?: string;
    actorClubId?: string | null;
  }): Promise<string[]> {
    const where: Prisma.RegistrationWhereInput = {
      organisationId: params.organisationId,
      eventId: params.eventId,
    };

    const effectiveClubId = params.actorClubId ?? params.clubId;
    if (effectiveClubId) where.clubId = effectiveClubId;

    const rows = await this.prisma.registration.findMany({
      where,
      distinct: ['categoryCode'],
      select: { categoryCode: true },
      orderBy: { categoryCode: 'asc' },
    });

    return rows.map((r) => r.categoryCode);
  }

  // Register an athlete in an event. The pipeline:
  //   1. Athlete must exist in this org; coaches' athletes must belong to
  //      their club (ATHLETE_NOT_IN_COACH_CLUB).
  //   2. Event must exist + allow registration changes for this actor.
  //   3. No prior (athlete, event) pair (REGISTRATION_ALREADY_EXISTS).
  //   4. Category must be valid for this event AND athlete-eligible.
  // On create we mirror eventWeightCategoryId into
  // registeredEventWeightCategoryId — the "initial" pick stays put even if
  // an admin later moves the registration up a class at weigh-in.
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

    let registration;
    try {
      registration = await this.prisma.registration.create({
        data: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          athleteId: input.athleteId,
          clubId: athlete.clubId,
          categoryCode: resolvedCategory.categoryCode,
          eventWeightCategoryId: resolvedCategory.eventWeightCategoryId,
          registeredEventWeightCategoryId:
            resolvedCategory.eventWeightCategoryId,
          notes: input.notes ?? null,
          status: 'PENDING',
          weighInStatus: 'NOT_WEIGHED',
        },
      });
    } catch (e) {
      // BF-8: the pre-check above can pass for two concurrent requests; the DB
      // @@unique([eventId, athleteId]) then rejects the second insert with P2002.
      // Surface it as the same domain error (→ 409) instead of an unmapped 500.
      // (Duck-typed on .code — Prisma is a type-only import in this module.)
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: unknown }).code === 'P2002'
      ) {
        throw new Error('REGISTRATION_ALREADY_EXISTS');
      }
      throw e;
    }

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

  // Change a registration's status with a multi-layer guard chain:
  //   - REGISTRATION_NOT_IN_COACH_CLUB if coach reaches outside their club
  //   - Coaches can only set SUBMITTED or WITHDRAWN (everything else is
  //     COACH_CANNOT_SET_STATUS)
  //   - Once the event is no longer in a mutable lifecycle, coaches can't
  //     touch it at all (REGISTRATION_LOCKED) and admins need override+reason
  //   - INVALID_STATUS_TRANSITION when target isn't reachable per the table
  //     above (admin override+reason bypasses, but coaches can never override)
  // Always writes an audit row with override=true if it bypassed any guard.
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

    if (
      input.actorClubId &&
      !isRegistrationMutableLifecycle(existing.event.lifecycle)
    ) {
      throw new Error('REGISTRATION_LOCKED');
    }
    if (isEventReadOnly(existing.event.lifecycle) && !input.override) {
      throw new Error('EVENT_READ_ONLY');
    }
    if (
      !isRegistrationMutableLifecycle(existing.event.lifecycle) &&
      !input.override
    ) {
      throw new Error('REGISTRATION_LOCKED');
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
    const isDirect = allowed.includes(input.newStatus);

    if (
      !isRegistrationMutableLifecycle(existing.event.lifecycle) &&
      input.actorClubId
    ) {
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

  // Move a registration to a different weight class. Admin-only — coaches
  // hit COACH_CANNOT_SET_CATEGORY even within the registration window
  // (category changes are an officiating decision, not a coach prerogative).
  // Special behavior:
  //   - registeredEventWeightCategoryId is PRESERVED when the move is an
  //     override (post-weigh-in adjustment): keeps the "initial pick" intact
  //     so the UI can show "moved up at weigh-in".
  //   - weighInStatus is reset to NOT_WEIGHED only while the lifecycle is
  //     still mutable; after weigh-in starts we don't want to silently wipe
  //     a final-status row.
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
    const requiresOverride =
      !lifecycleMutable || isEventReadOnly(existing.event.lifecycle);
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
          ? (existing.registeredEventWeightCategoryId ??
            existing.eventWeightCategoryId)
          : resolvedCategory.eventWeightCategoryId,
        weighInStatus: lifecycleMutable
          ? 'NOT_WEIGHED'
          : existing.weighInStatus,
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
