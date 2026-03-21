import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isWeighInStage } from '../events/lifecycle-rules';
import { computePolicyWeighInOutcome, type WeightCategoryBounds } from './weighin.logic';
import { mapPreviewStateFromOutcome, toCategorySummary } from './weighin.preview.mapper';
import type { WeighInDecisionPreviewResponse } from './weighin.preview.types';
import {
  extractOpenOneHourWindow,
  FINAL_WEIGHIN_STATUSES,
  findCategoryById,
  findNextHigherMatchingCategory,
  metricFromCategory,
  toBounds,
  type RegistrationPreviewContext,
} from './weighin-preview.helpers';

@Injectable()
export class WeighinPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRegistrationForPreview(input: {
    registrationId: string;
    organisationId: string;
  }): Promise<RegistrationPreviewContext> {
    const registration = await this.prisma.registration.findFirst({
      where: {
        id: input.registrationId,
        organisationId: input.organisationId,
      },
      select: {
        id: true,
        eventId: true,
        weighInStatus: true,
        eventWeightCategory: {
          select: {
            id: true,
            categoryTemplateWeight: {
              select: {
                name: true,
                minWeightKgExcl: true,
                maxWeightKgIncl: true,
                sortOrder: true,
              },
            },
            eventAgeGroup: {
              select: {
                weightCategories: {
                  select: {
                    id: true,
                    categoryTemplateWeight: {
                      select: {
                        name: true,
                        minWeightKgExcl: true,
                        maxWeightKgIncl: true,
                        sortOrder: true,
                      },
                    },
                  },
                  orderBy: {
                    categoryTemplateWeight: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
        registeredEventWeightCategory: {
          select: {
            id: true,
            categoryTemplateWeight: {
              select: {
                name: true,
                minWeightKgExcl: true,
                maxWeightKgIncl: true,
                sortOrder: true,
              },
            },
          },
        },
        weighIns: {
          select: {
            id: true,
            attemptNo: true,
            weightKg: true,
            decision: true,
            deadlineAt: true,
            resolvedAt: true,
            reason: true,
            override: true,
            createdAt: true,
            operatorUserId: true,
            operator: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
          orderBy: { attemptNo: 'asc' },
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
    });

    if (!registration) throw new Error('REGISTRATION_NOT_FOUND');
    return registration;
  }

  async preview(input: {
    organisationId: string;
    registrationId: string;
    weightKg: number;
  }): Promise<WeighInDecisionPreviewResponse> {
    if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
      throw new Error('INVALID_WEIGHT');
    }

    const now = new Date();
    const registration = await this.getRegistrationForPreview({
      registrationId: input.registrationId,
      organisationId: input.organisationId,
    });
    if (!registration.eventWeightCategory) {
      throw new Error('REGISTRATION_CATEGORY_NOT_SET');
    }

    const currentCategory: WeightCategoryBounds = {
      id: registration.eventWeightCategory.id,
      name: registration.eventWeightCategory.categoryTemplateWeight.name,
      minWeightKgExcl:
        registration.eventWeightCategory.categoryTemplateWeight.minWeightKgExcl,
      maxWeightKgIncl:
        registration.eventWeightCategory.categoryTemplateWeight.maxWeightKgIncl,
      sortOrder: registration.eventWeightCategory.categoryTemplateWeight.sortOrder,
    };
    const categories = toBounds(registration.eventWeightCategory);
    const openOneHourWindow = extractOpenOneHourWindow(registration, now);
    const alreadyRecorded =
      FINAL_WEIGHIN_STATUSES.has(registration.weighInStatus) &&
      openOneHourWindow == null;
    const manualPolicy =
      registration.event.weighInPolicyCode === 'MANUAL_ADMIN_DECISION';

    const outcome =
      !alreadyRecorded && !manualPolicy
        ? computePolicyWeighInOutcome({
            policyCode: registration.event.weighInPolicyCode,
            weightKg: input.weightKg,
            currentCategory,
            categoriesInAgeGroup: categories,
            attemptHistory: registration.weighIns.map((attempt) => ({
              decision: attempt.decision,
              deadlineAt: attempt.deadlineAt,
              resolvedAt: attempt.resolvedAt,
            })),
            reweighWindowMinutes: registration.event.reweighWindowMinutes,
            now,
          })
        : null;

    const fallbackNextCategory = findNextHigherMatchingCategory({
      weightKg: input.weightKg,
      currentCategory,
      categories,
    });
    const nextCategory =
      findCategoryById(categories, outcome?.moveToCategoryId) ?? fallbackNextCategory;

    const mapped = mapPreviewStateFromOutcome({
      alreadyRecorded,
      manualPolicy,
      outcome,
      nextCategory: nextCategory ? toCategorySummary(nextCategory) : null,
    });
    const recordingAllowed = isWeighInStage(registration.event.lifecycle);
    const metrics = metricFromCategory(input.weightKg, currentCategory);
    const latest = registration.weighIns[registration.weighIns.length - 1] ?? null;
    const registeredCategory = registration.registeredEventWeightCategory;

    return {
      registrationId: registration.id,
      eventId: registration.event.id,
      eventName: registration.event.name,
      policyCode: registration.event.weighInPolicyCode,
      recordingAllowed,
      recordingBlockedCode: recordingAllowed ? null : 'EVENT_NOT_IN_WEIGHIN',
      measuredWeightKg: input.weightKg,
      decisionState: mapped.decisionState,
      summaryCode: mapped.summaryCode,
      policyReasonCode: mapped.policyReasonCode,
      previewDecision: mapped.previewDecision,
      previewStatus: mapped.previewStatus,
      allowedActions: recordingAllowed ? mapped.allowedActions : [],
      currentCategory: toCategorySummary(currentCategory),
      registeredCategory: registeredCategory
        ? toCategorySummary({
            id: registeredCategory.id,
            name: registeredCategory.categoryTemplateWeight.name,
            minWeightKgExcl:
              registeredCategory.categoryTemplateWeight.minWeightKgExcl,
            maxWeightKgIncl:
              registeredCategory.categoryTemplateWeight.maxWeightKgIncl,
            sortOrder: registeredCategory.categoryTemplateWeight.sortOrder,
          })
        : null,
      finalCategory: toCategorySummary(currentCategory),
      nextCategory: nextCategory ? toCategorySummary(nextCategory) : null,
      attemptsCount: registration.weighIns.length,
      overLimitKg: metrics.overLimitKg,
      underLimitKg: metrics.underLimitKg,
      deltaToLimitKg: metrics.deltaToLimitKg,
      openOneHourWindow,
      latestRecord: latest
        ? {
            attemptId: latest.id,
            attemptNo: latest.attemptNo,
            decision: latest.decision,
            weightKg: latest.weightKg,
            createdAt: latest.createdAt,
            operatorUserId: latest.operatorUserId,
            operatorDisplayName: latest.operator?.displayName ?? null,
            reason: latest.reason,
            override: latest.override,
          }
        : null,
    };
  }
}
