import { Injectable } from '@nestjs/common';
import type {
  DrawCategoryDetailsResponse,
  DrawComputedOverview,
  DrawOverviewResponse,
} from './draw.readiness.types';
import { DrawReadinessQueryService } from './draw.readiness.queries';
import { computeDrawReadiness } from './draw.readiness.compute';

@Injectable()
export class DrawReadinessService {
  constructor(private readonly query: DrawReadinessQueryService) {}

  async computeOverview(input: {
    organisationId: string;
    eventId: string;
  }): Promise<DrawComputedOverview> {
    const context = await this.query.loadContext(input);
    return computeDrawReadiness(context);
  }

  async getOverview(input: {
    organisationId: string;
    eventId: string;
  }): Promise<DrawOverviewResponse> {
    const computed = await this.computeOverview(input);
    return computed.overview;
  }

  async getCategoryDetails(input: {
    organisationId: string;
    eventId: string;
    eventWeightCategoryId: string;
  }): Promise<DrawCategoryDetailsResponse> {
    const computed = await this.computeOverview({
      organisationId: input.organisationId,
      eventId: input.eventId,
    });

    const category = computed.categoriesById.get(input.eventWeightCategoryId);
    if (!category) throw new Error('CATEGORY_NOT_FOUND');

    return {
      eventId: input.eventId,
      category: {
        id: category.id,
        ageGroupCode: category.ageGroupCode,
        ageGroupName: category.ageGroupName,
        division: category.division,
        categoryName: category.categoryName,
        sortOrder: category.sortOrder,
        bracketStatus: category.bracketStatus,
        readinessStatus: category.readinessStatus,
        eligibleAthletesCount: category.eligibleAthletesCount,
        excludedAthletesCount: category.excludedAthletesCount,
        criticalIssueCount: category.criticalIssueCount,
        warningIssueCount: category.warningIssueCount,
        issueCount: category.issueCount,
        hasMovedUpAthletes: category.hasMovedUpAthletes,
        hasOverrideAthletes: category.hasOverrideAthletes,
        issues: category.issues,
      },
      eligibleAthletes: category.eligibleAthletes,
      excludedAthletes: category.excludedAthletes,
    };
  }
}
