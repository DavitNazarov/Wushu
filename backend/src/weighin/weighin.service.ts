import { Injectable } from '@nestjs/common';
import type { Prisma, WeighInDecision } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class WeighinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async search(params: {
    organisationId: string;
    eventId: string;
    q?: string;
  }) {
    const { organisationId, eventId, q } = params;

    const where: Prisma.RegistrationWhereInput = { organisationId, eventId };

    if (q?.trim()) {
      const search = q.trim();
      where.athlete = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { documentId: { contains: search, mode: 'insensitive' } },
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
            documentId: true,
            sex: true,
          },
        },
        club: { select: { id: true, name: true } },
        weighIns: { orderBy: { attemptNo: 'asc' } },
        eventWeightCategory: {
          include: {
            rulesetWeightCategory: {
              select: {
                name: true,
                minWeightKgExcl: true,
                maxWeightKgIncl: true,
              },
            },
            eventAgeGroup: {
              include: {
                rulesetAgeGroup: {
                  select: { name: true, roundDurationSeconds: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ categoryCode: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Checks measured weight against the registration's category limits.
   *  Returns the expected decision or null if no structured category is linked. */
  async getCategoryInfo(registrationId: string, organisationId: string) {
    const reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, organisationId },
      include: {
        eventWeightCategory: {
          include: {
            rulesetWeightCategory: true,
            eventAgeGroup: {
              include: {
                rulesetAgeGroup: true,
                weightCategories: {
                  include: {
                    rulesetWeightCategory: {
                      select: {
                        maxWeightKgIncl: true,
                        sortOrder: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: { rulesetWeightCategory: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      },
    });
    if (!reg) return null;
    return reg.eventWeightCategory;
  }

  async record(input: {
    organisationId: string;
    actorUserId: string;
    registrationId: string;
    weightKg: number;
    decision: WeighInDecision;
    override?: boolean;
    reason?: string | null;
  }) {
    const registration = await this.prisma.registration.findFirst({
      where: { id: input.registrationId, organisationId: input.organisationId },
      include: {
        weighIns: { orderBy: { attemptNo: 'desc' }, take: 1 },
        eventWeightCategory: {
          include: { rulesetWeightCategory: true },
        },
      },
    });
    if (!registration) throw new Error('REGISTRATION_NOT_FOUND');

    const event = await this.prisma.event.findFirst({
      where: { id: registration.eventId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    if (event.lifecycle !== 'WEIGHIN' && !input.override) {
      throw new Error('EVENT_NOT_IN_WEIGHIN');
    }

    if (input.override && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    // Validate decision against weight limits when a structured category is linked
    if (registration.eventWeightCategory && !input.override) {
      const max =
        registration.eventWeightCategory.rulesetWeightCategory.maxWeightKgIncl;
      const min =
        registration.eventWeightCategory.rulesetWeightCategory.minWeightKgExcl;
      const withinLimits =
        (max === null || input.weightKg <= max) &&
        (min === null || input.weightKg > min);

      if (withinLimits && input.decision === 'FAIL') {
        throw new Error('WEIGHT_WITHIN_LIMITS_CANNOT_FAIL');
      }
      if (!withinLimits && input.decision === 'PASS') {
        throw new Error('WEIGHT_EXCEEDS_CATEGORY_LIMIT');
      }
    }

    const lastAttemptNo = registration.weighIns[0]?.attemptNo ?? 0;
    const attemptNo = lastAttemptNo + 1;
    const deadlineAt =
      input.decision === 'ONE_HOUR'
        ? new Date(Date.now() + 60 * 60 * 1000)
        : null;

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.weighInAttempt.create({
        data: {
          organisationId: input.organisationId,
          eventId: registration.eventId,
          registrationId: input.registrationId,
          attemptNo,
          weightKg: input.weightKg,
          decision: input.decision,
          deadlineAt,
          operatorUserId: input.actorUserId,
          override: input.override ?? false,
          reason: input.reason ?? null,
        },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: registration.eventId,
        actorUserId: input.actorUserId,
        action: 'WEIGHIN_DECISION',
        entityType: 'weighin',
        entityId: created.id,
        before: null,
        after: created as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: input.override ?? false,
      });

      return created;
    });

    return attempt;
  }

  async resolveOneHour(input: {
    organisationId: string;
    actorUserId: string;
    attemptId: string;
    action: 'MOVE_UP' | 'DQ';
    /** New EventWeightCategory id (preferred) or legacy category code */
    nextEventWeightCategoryId?: string | null;
    newCategoryCode?: string | null;
    reason?: string | null;
  }) {
    const attempt = await this.prisma.weighInAttempt.findFirst({
      where: {
        id: input.attemptId,
        organisationId: input.organisationId,
        decision: 'ONE_HOUR',
      },
      include: {
        registration: {
          include: {
            eventWeightCategory: {
              include: {
                rulesetWeightCategory: true,
                eventAgeGroup: {
                  include: {
                    weightCategories: {
                      include: { rulesetWeightCategory: true },
                      orderBy: { rulesetWeightCategory: { sortOrder: 'asc' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');
    if (attempt.resolvedAt) throw new Error('ALREADY_RESOLVED');

    // Validate move-up target is an enabled event category one step higher
    let nextEventWeightCategoryId = input.nextEventWeightCategoryId ?? null;
    let newCategoryCode = input.newCategoryCode ?? null;

    if (input.action === 'MOVE_UP') {
      if (nextEventWeightCategoryId) {
        // Validate it belongs to the same event
        const targetCat = await this.prisma.eventWeightCategory.findFirst({
          where: {
            id: nextEventWeightCategoryId,
            eventAgeGroup: { eventId: attempt.eventId },
          },
          include: { rulesetWeightCategory: true },
        });
        if (!targetCat) throw new Error('INVALID_MOVE_UP_CATEGORY');
        newCategoryCode = targetCat.rulesetWeightCategory.name;
      } else if (attempt.registration.eventWeightCategory) {
        // Auto-find the next higher category in the same age group
        const currentSortOrder =
          attempt.registration.eventWeightCategory.rulesetWeightCategory
            .sortOrder;
        const candidates =
          attempt.registration.eventWeightCategory.eventAgeGroup
            .weightCategories;
        const next = candidates.find(
          (wc) => wc.rulesetWeightCategory.sortOrder > currentSortOrder,
        );
        if (!next) throw new Error('NO_HIGHER_CATEGORY_AVAILABLE');
        nextEventWeightCategoryId = next.id;
        newCategoryCode = next.rulesetWeightCategory.name;
      } else if (!newCategoryCode) {
        throw new Error('MOVE_UP_CATEGORY_REQUIRED');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const resolvedAttempt = await tx.weighInAttempt.update({
        where: { id: input.attemptId },
        data: { resolvedAt: new Date(), resolvedAction: input.action },
      });

      if (input.action === 'MOVE_UP') {
        await tx.registration.update({
          where: { id: attempt.registrationId },
          data: {
            categoryCode: newCategoryCode ?? attempt.registration.categoryCode,
            eventWeightCategoryId: nextEventWeightCategoryId,
          },
        });

        const nextAttemptNo = attempt.attemptNo + 1;
        await tx.weighInAttempt.create({
          data: {
            organisationId: input.organisationId,
            eventId: attempt.eventId,
            registrationId: attempt.registrationId,
            attemptNo: nextAttemptNo,
            weightKg: attempt.weightKg,
            decision: 'PASS',
            operatorUserId: input.actorUserId,
            override: true,
            reason: `Moved up from ONE_HOUR: ${input.reason ?? 'category moved up'}`,
          },
        });
      } else {
        await tx.registration.update({
          where: { id: attempt.registrationId },
          data: { status: 'REJECTED' },
        });
      }

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: attempt.eventId,
        actorUserId: input.actorUserId,
        action: 'WEIGHIN_ONE_HOUR_RESOLVED',
        entityType: 'weighin',
        entityId: input.attemptId,
        before: attempt as unknown as Prisma.JsonValue,
        after: {
          action: input.action,
          nextEventWeightCategoryId,
          newCategoryCode,
        } as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: true,
      });

      return resolvedAttempt;
    });
  }
}
