import { Injectable } from '@nestjs/common';
import type {
  AthleteSex,
  EventLifecycle,
  Prisma,
  Registration,
  WeighInDecision,
  WeighInStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { isWeighInStage } from '../events/lifecycle-rules';
import { EventStageAutomationService } from '../events/event-stage-automation.service';
import {
  computeManualDecisionOutcome,
  computePolicyWeighInOutcome,
  type PolicyWeighInOutcome,
  type WeightCategoryBounds,
} from './weighin.logic';

type RegistrationWithWeighInContext = Registration & {
  event: {
    id: string;
    lifecycle: EventLifecycle;
    weighInPolicyCode:
      | 'IWUF_STRICT_ONE_HOUR'
      | 'MOVE_UP_AFTER_FAILED_REWEIGH'
      | 'DIRECT_MOVE_UP'
      | 'MANUAL_ADMIN_DECISION';
    reweighWindowMinutes: number;
  };
  weighIns: Array<{
    attemptNo: number;
    decision: WeighInDecision;
    deadlineAt: Date | null;
    resolvedAt: Date | null;
  }>;
  eventWeightCategory: {
    id: string;
    categoryTemplateWeight: {
      name: string;
      minWeightKgExcl: number | null;
      maxWeightKgIncl: number | null;
      sortOrder: number;
    };
    eventAgeGroup: {
      weightCategories: Array<{
        id: string;
        categoryTemplateWeight: {
          name: string;
          minWeightKgExcl: number | null;
          maxWeightKgIncl: number | null;
          sortOrder: number;
        };
      }>;
    };
  } | null;
};

@Injectable()
export class WeighinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eventStageAutomation: EventStageAutomationService,
  ) {}

  private toBounds(
    cat: RegistrationWithWeighInContext['eventWeightCategory'],
  ): WeightCategoryBounds[] {
    if (!cat) return [];
    return cat.eventAgeGroup.weightCategories.map((entry) => ({
      id: entry.id,
      name: entry.categoryTemplateWeight.name,
      minWeightKgExcl: entry.categoryTemplateWeight.minWeightKgExcl,
      maxWeightKgIncl: entry.categoryTemplateWeight.maxWeightKgIncl,
      sortOrder: entry.categoryTemplateWeight.sortOrder,
    }));
  }

  private async getRegistrationForRecord(
    registrationId: string,
    organisationId: string,
  ): Promise<RegistrationWithWeighInContext> {
    const registration = await this.prisma.registration.findFirst({
      where: { id: registrationId, organisationId },
      include: {
        event: {
          select: {
            id: true,
            lifecycle: true,
            weighInPolicyCode: true,
            reweighWindowMinutes: true,
          },
        },
        weighIns: {
          select: {
            attemptNo: true,
            decision: true,
            deadlineAt: true,
            resolvedAt: true,
          },
          orderBy: { attemptNo: 'desc' },
        },
        eventWeightCategory: {
          include: {
            categoryTemplateWeight: {
              select: {
                name: true,
                minWeightKgExcl: true,
                maxWeightKgIncl: true,
                sortOrder: true,
              },
            },
            eventAgeGroup: {
              include: {
                weightCategories: {
                  include: {
                    categoryTemplateWeight: {
                      select: {
                        name: true,
                        minWeightKgExcl: true,
                        maxWeightKgIncl: true,
                        sortOrder: true,
                      },
                    },
                  },
                  orderBy: { categoryTemplateWeight: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      },
    });
    if (!registration) throw new Error('REGISTRATION_NOT_FOUND');
    return registration;
  }

  private async resolveMoveToCategory(input: {
    eventId: string;
    moveToCategoryId: string;
  }) {
    const targetCategory = await this.prisma.eventWeightCategory.findFirst({
      where: {
        id: input.moveToCategoryId,
        eventAgeGroup: { eventId: input.eventId },
      },
      include: {
        categoryTemplateWeight: { select: { name: true } },
      },
    });
    if (!targetCategory) throw new Error('INVALID_MOVE_UP_CATEGORY');
    return targetCategory;
  }

  private statusForOverrideOutcome(
    outcome: PolicyWeighInOutcome,
  ): WeighInStatus {
    if (outcome.decision === 'FAIL') return 'FAILED';
    if (outcome.decision === 'DISQUALIFIED') return 'DISQUALIFIED';
    if (outcome.decision === 'ONE_HOUR' || outcome.decision === 'REWEIGH') {
      return 'REWEIGH_ALLOWED';
    }
    return 'OVERRIDE_APPROVED';
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

  private athleteMatchesAgeGroup(input: {
    athleteDob: Date;
    athleteSex: AthleteSex | null;
    competitionStartDate: Date;
    ageGroup: {
      minAge: number | null;
      maxAge: number | null;
      sex: AthleteSex | null;
    };
  }): boolean {
    const age = this.computeAgeOnDate(
      input.athleteDob,
      input.competitionStartDate,
    );
    if (input.ageGroup.minAge != null && age < input.ageGroup.minAge) {
      return false;
    }
    if (input.ageGroup.maxAge != null && age > input.ageGroup.maxAge) {
      return false;
    }
    if (input.ageGroup.sex && input.athleteSex && input.ageGroup.sex !== input.athleteSex) {
      return false;
    }
    return true;
  }

  async search(params: {
    organisationId: string;
    actorUserId?: string;
    eventId: string;
    q?: string;
  }) {
    const { organisationId, actorUserId, eventId, q } = params;

    const where: Prisma.RegistrationWhereInput = { organisationId, eventId };

    if (q?.trim()) {
      const search = q.trim();
      where.OR = [
        {
          athlete: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { documentId: { contains: search, mode: 'insensitive' } },
              { id: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          club: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const fetchRows = () =>
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
              documentId: true,
              sex: true,
            },
          },
          club: { select: { id: true, name: true } },
          weighIns: {
            include: {
              operator: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
            orderBy: { attemptNo: 'asc' },
          },
          eventWeightCategory: {
            include: {
              categoryTemplateWeight: {
                select: {
                  name: true,
                  minWeightKgExcl: true,
                  maxWeightKgIncl: true,
                  sortOrder: true,
                },
              },
              eventAgeGroup: {
                include: {
                  categoryTemplateAgeGroup: {
                    select: {
                      code: true,
                      name: true,
                      sex: true,
                      minAge: true,
                      maxAge: true,
                      roundDurationSeconds: true,
                      sortOrder: true,
                    },
                  },
                  weightCategories: {
                    include: {
                      categoryTemplateWeight: {
                        select: {
                          name: true,
                          minWeightKgExcl: true,
                          maxWeightKgIncl: true,
                          sortOrder: true,
                        },
                      },
                    },
                    orderBy: { categoryTemplateWeight: { sortOrder: 'asc' } },
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
          event: {
            select: {
              id: true,
              name: true,
              lifecycle: true,
              weighInPolicyCode: true,
              reweighWindowMinutes: true,
            },
          },
        },
        orderBy: [{ categoryCode: 'asc' }, { createdAt: 'asc' }],
      });

    const rows = await fetchRows();
    if (!actorUserId) {
      return rows;
    }

    const missingMappings = rows.filter(
      (row) =>
        row.eventWeightCategory == null &&
        row.registeredEventWeightCategory == null &&
        Boolean(row.categoryCode?.trim()),
    );

    if (!missingMappings.length) {
      return rows;
    }

    const reconcileResults = await Promise.allSettled(
      missingMappings.map((row) =>
        this.reconcileCategoryMapping({
          organisationId,
          actorUserId,
          registrationId: row.id,
          reason: 'Auto-reconciled during weigh-in queue load',
        }),
      ),
    );

    const reconciledCount = reconcileResults.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    if (reconciledCount === 0) {
      return rows;
    }

    return fetchRows();
  }

  async getCategoryInfo(registrationId: string, organisationId: string) {
    const reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, organisationId },
      include: {
        eventWeightCategory: {
          include: {
            categoryTemplateWeight: true,
            eventAgeGroup: {
              include: {
                categoryTemplateAgeGroup: true,
                weightCategories: {
                  include: {
                    categoryTemplateWeight: {
                      select: {
                        minWeightKgExcl: true,
                        maxWeightKgIncl: true,
                        sortOrder: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: { categoryTemplateWeight: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
        event: {
          select: {
            weighInPolicyCode: true,
            reweighWindowMinutes: true,
          },
        },
      },
    });
    if (!reg) return null;
    return reg;
  }

  async record(input: {
    organisationId: string;
    actorUserId: string;
    registrationId: string;
    weightKg: number;
    decision?: WeighInDecision;
    override?: boolean;
    reason?: string | null;
    nextEventWeightCategoryId?: string | null;
  }) {
    if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
      throw new Error('INVALID_WEIGHT');
    }

    const registration = await this.getRegistrationForRecord(
      input.registrationId,
      input.organisationId,
    );

    if (!isWeighInStage(registration.event.lifecycle) && !input.override) {
      throw new Error('EVENT_NOT_IN_WEIGHIN');
    }

    if (!registration.eventWeightCategory) {
      throw new Error('REGISTRATION_CATEGORY_NOT_SET');
    }

    const currentCategory = {
      id: registration.eventWeightCategory.id,
      name: registration.eventWeightCategory.categoryTemplateWeight.name,
      minWeightKgExcl:
        registration.eventWeightCategory.categoryTemplateWeight.minWeightKgExcl,
      maxWeightKgIncl:
        registration.eventWeightCategory.categoryTemplateWeight.maxWeightKgIncl,
      sortOrder: registration.eventWeightCategory.categoryTemplateWeight.sortOrder,
    };
    const categoriesInAgeGroup = this.toBounds(registration.eventWeightCategory);

    let outcome: PolicyWeighInOutcome;
    if (input.override) {
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
      if (!input.decision) throw new Error('OVERRIDE_DECISION_REQUIRED');
      outcome = computeManualDecisionOutcome({
        decision: input.decision,
        reason: input.reason,
        currentCategory,
        categoriesInAgeGroup,
        weightKg: input.weightKg,
        reweighWindowMinutes: registration.event.reweighWindowMinutes,
        nextEventWeightCategoryId: input.nextEventWeightCategoryId ?? null,
      });
    } else if (registration.event.weighInPolicyCode === 'MANUAL_ADMIN_DECISION') {
      if (!input.decision) throw new Error('MANUAL_DECISION_REQUIRED');
      if (!input.reason) throw new Error('MANUAL_DECISION_REASON_REQUIRED');
      outcome = computeManualDecisionOutcome({
        decision: input.decision,
        reason: input.reason,
        currentCategory,
        categoriesInAgeGroup,
        weightKg: input.weightKg,
        reweighWindowMinutes: registration.event.reweighWindowMinutes,
        nextEventWeightCategoryId: input.nextEventWeightCategoryId ?? null,
      });
    } else {
      outcome = computePolicyWeighInOutcome({
        policyCode: registration.event.weighInPolicyCode,
        weightKg: input.weightKg,
        currentCategory,
        categoriesInAgeGroup,
        attemptHistory: registration.weighIns,
        reweighWindowMinutes: registration.event.reweighWindowMinutes,
      });

      if (outcome.reason === 'MANUAL_DECISION_REQUIRED') {
        throw new Error('MANUAL_DECISION_REQUIRED');
      }
    }

    let moveToCategory:
      | {
          id: string;
          categoryTemplateWeight: { name: string };
        }
      | null = null;

    if (outcome.moveToCategoryId) {
      moveToCategory = await this.resolveMoveToCategory({
        eventId: registration.event.id,
        moveToCategoryId: outcome.moveToCategoryId,
      });
    }

    const lastAttemptNo = registration.weighIns[0]?.attemptNo ?? 0;
    const attemptNo = lastAttemptNo + 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.weighInAttempt.create({
        data: {
          organisationId: input.organisationId,
          eventId: registration.event.id,
          registrationId: input.registrationId,
          attemptNo,
          weightKg: input.weightKg,
          decision: outcome.decision,
          policyCode: registration.event.weighInPolicyCode,
          deadlineAt: outcome.deadlineAt,
          operatorUserId: input.actorUserId,
          override: input.override ?? false,
          reason: input.reason ?? outcome.reason,
        },
      });

      const newStatus = input.override
        ? this.statusForOverrideOutcome(outcome)
        : outcome.weighInStatus;

      const registrationUpdate: Prisma.RegistrationUpdateInput = {
        weighInStatus: newStatus,
      };
      if (moveToCategory) {
        registrationUpdate.eventWeightCategory = {
          connect: { id: moveToCategory.id },
        };
        registrationUpdate.categoryCode = moveToCategory.categoryTemplateWeight.name;
      }
      if (outcome.decision === 'DISQUALIFIED') {
        registrationUpdate.status = 'REJECTED';
      }

      const updatedRegistration = await tx.registration.update({
        where: { id: input.registrationId },
        data: registrationUpdate,
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: registration.event.id,
          actorUserId: input.actorUserId,
          action: 'WEIGHIN_WEIGHT_RECORDED',
          entityType: 'weighin',
          entityId: attempt.id,
          before: null,
          after: {
            registrationId: input.registrationId,
            weightKg: input.weightKg,
            decision: attempt.decision,
            policyCode: attempt.policyCode,
            deadlineAt: attempt.deadlineAt,
          } as unknown as Prisma.JsonValue,
          reason: input.reason ?? null,
          override: input.override ?? false,
        },
        tx,
      );

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: registration.event.id,
          actorUserId: input.actorUserId,
          action: input.override
            ? 'WEIGHIN_OVERRIDE_APPLIED'
            : outcome.decision === 'PASS'
              ? 'WEIGHIN_AUTO_PASSED'
              : outcome.decision === 'MOVED_UP'
                ? 'WEIGHIN_AUTO_MOVED_UP'
                : outcome.decision === 'ONE_HOUR'
                  ? 'WEIGHIN_AUTO_REWEIGH_ALLOWED'
                  : outcome.decision === 'DISQUALIFIED'
                    ? 'WEIGHIN_AUTO_DISQUALIFIED'
                    : 'WEIGHIN_AUTO_FAILED',
          entityType: 'registration',
          entityId: input.registrationId,
          before: {
            eventWeightCategoryId: registration.eventWeightCategoryId,
            categoryCode: registration.categoryCode,
            weighInStatus: registration.weighInStatus,
            status: registration.status,
          } as unknown as Prisma.JsonValue,
          after: {
            eventWeightCategoryId: updatedRegistration.eventWeightCategoryId,
            categoryCode: updatedRegistration.categoryCode,
            weighInStatus: updatedRegistration.weighInStatus,
            status: updatedRegistration.status,
            decision: outcome.decision,
          } as unknown as Prisma.JsonValue,
          reason: input.reason ?? outcome.reason,
          override: input.override ?? false,
        },
        tx,
      );

      return {
        attempt,
        registration: updatedRegistration,
        outcome,
      };
    });

    await this.eventStageAutomation.maybeAutoAdvanceById(registration.event.id);

    return result;
  }

  async resolveOneHour(input: {
    organisationId: string;
    actorUserId: string;
    attemptId: string;
    action: 'MOVE_UP' | 'DQ';
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
                categoryTemplateWeight: true,
                eventAgeGroup: {
                  include: {
                    weightCategories: {
                      include: { categoryTemplateWeight: true },
                      orderBy: { categoryTemplateWeight: { sortOrder: 'asc' } },
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

    let nextEventWeightCategoryId = input.nextEventWeightCategoryId ?? null;
    let newCategoryCode = input.newCategoryCode ?? null;

    if (input.action === 'MOVE_UP') {
      if (nextEventWeightCategoryId) {
        const targetCat = await this.prisma.eventWeightCategory.findFirst({
          where: {
            id: nextEventWeightCategoryId,
            eventAgeGroup: { eventId: attempt.eventId },
          },
          include: { categoryTemplateWeight: true },
        });
        if (!targetCat) throw new Error('INVALID_MOVE_UP_CATEGORY');
        newCategoryCode = targetCat.categoryTemplateWeight.name;
      } else if (attempt.registration.eventWeightCategory) {
        const currentSortOrder =
          attempt.registration.eventWeightCategory.categoryTemplateWeight.sortOrder;
        const candidates =
          attempt.registration.eventWeightCategory.eventAgeGroup.weightCategories;
        const next = candidates.find(
          (wc) => wc.categoryTemplateWeight.sortOrder > currentSortOrder,
        );
        if (!next) throw new Error('NO_HIGHER_CATEGORY_AVAILABLE');
        nextEventWeightCategoryId = next.id;
        newCategoryCode = next.categoryTemplateWeight.name;
      } else if (!newCategoryCode) {
        throw new Error('MOVE_UP_CATEGORY_REQUIRED');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
            weighInStatus: 'MOVED_UP',
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
            decision: 'MOVED_UP',
            policyCode: attempt.policyCode,
            operatorUserId: input.actorUserId,
            override: true,
            reason: `Resolved ONE_HOUR with move-up: ${input.reason ?? 'manual resolution'}`,
          },
        });
      } else {
        await tx.registration.update({
          where: { id: attempt.registrationId },
          data: { status: 'REJECTED', weighInStatus: 'DISQUALIFIED' },
        });
      }

      await this.audit.write(
        {
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
        },
        tx,
      );

      return resolvedAttempt;
    });

    await this.eventStageAutomation.maybeAutoAdvanceById(attempt.eventId);

    return result;
  }

  async reconcileCategoryMapping(input: {
    organisationId: string;
    actorUserId: string;
    registrationId: string;
    reason?: string | null;
  }) {
    const registration = await this.prisma.registration.findFirst({
      where: {
        id: input.registrationId,
        organisationId: input.organisationId,
      },
      include: {
        event: {
          select: {
            id: true,
            competitionStartDate: true,
          },
        },
        athlete: {
          select: {
            dateOfBirth: true,
            sex: true,
          },
        },
      },
    });
    if (!registration) throw new Error('REGISTRATION_NOT_FOUND');

    if (registration.eventWeightCategoryId && registration.registeredEventWeightCategoryId) {
      return registration;
    }
    const normalizedCategoryCode = registration.categoryCode?.trim();
    if (!normalizedCategoryCode) throw new Error('CATEGORY_CODE_MISSING');

    const byNameCandidates = await this.prisma.eventWeightCategory.findMany({
      where: {
        eventAgeGroup: {
          eventId: registration.eventId,
        },
        categoryTemplateWeight: {
          name: { equals: normalizedCategoryCode, mode: 'insensitive' },
        },
      },
      include: {
        categoryTemplateWeight: {
          select: { name: true },
        },
        eventAgeGroup: {
          include: {
            categoryTemplateAgeGroup: {
              select: {
                minAge: true,
                maxAge: true,
                sex: true,
              },
            },
          },
        },
      },
    });

    const eligibleCandidates = byNameCandidates.filter((candidate) =>
      this.athleteMatchesAgeGroup({
        athleteDob: registration.athlete.dateOfBirth,
        athleteSex: registration.athlete.sex,
        competitionStartDate: registration.event.competitionStartDate,
        ageGroup: candidate.eventAgeGroup.categoryTemplateAgeGroup,
      }),
    );

    if (eligibleCandidates.length === 0) {
      throw new Error('NO_MATCHING_EVENT_CATEGORY');
    }
    if (eligibleCandidates.length > 1) {
      throw new Error('AMBIGUOUS_EVENT_CATEGORY_MATCH');
    }

    const target = eligibleCandidates[0];

    const updated = await this.prisma.registration.update({
      where: { id: registration.id },
      data: {
        eventWeightCategoryId: target.id,
        registeredEventWeightCategoryId:
          registration.registeredEventWeightCategoryId ?? target.id,
      },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: registration.eventId,
      actorUserId: input.actorUserId,
      action: 'REGISTRATION_CATEGORY_RECONCILED',
      entityType: 'registration',
      entityId: registration.id,
      before: {
        eventWeightCategoryId: registration.eventWeightCategoryId,
        registeredEventWeightCategoryId: registration.registeredEventWeightCategoryId,
        categoryCode: registration.categoryCode,
      } as unknown as Prisma.JsonValue,
      after: {
        eventWeightCategoryId: updated.eventWeightCategoryId,
        registeredEventWeightCategoryId: updated.registeredEventWeightCategoryId,
        categoryCode: updated.categoryCode,
      } as unknown as Prisma.JsonValue,
      reason: input.reason ?? 'Auto-reconciled from categoryCode',
      override: true,
    });

    return updated;
  }
}
