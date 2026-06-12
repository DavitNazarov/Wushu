import { Injectable } from '@nestjs/common';
import type {
  DrawCategoryDetailsResponse,
  DrawComputedOverview,
  DrawOverviewResponse,
} from './draw.readiness.types';
import { DrawReadinessQueryService } from './draw.readiness.queries';
import { computeDrawReadiness } from './draw.readiness.compute';

// Thin orchestrator: pulls the data context via DrawReadinessQueryService,
// runs the pure compute step via computeDrawReadiness, and exposes the two
// shapes the controller cares about (overview + per-category details).
// Kept thin so the heavy compute logic stays unit-testable on its own.
@Injectable()
export class DrawReadinessService {
  constructor(private readonly query: DrawReadinessQueryService) {}

  // Full computed result with both the overview and a per-category map.
  // Internal API — exposes the map so getCategoryDetails can pick from it.
  async computeOverview(input: {
    organisationId: string;
    eventId: string;
  }): Promise<DrawComputedOverview> {
    const context = await this.query.loadContext(input);
    return computeDrawReadiness(context);
  }

  // The narrowed "summary" view exposed at GET /draw/overview — drops the
  // per-category map.
  async getOverview(input: {
    organisationId: string;
    eventId: string;
  }): Promise<DrawOverviewResponse> {
    const computed = await this.computeOverview(input);
    return computed.overview;
  }

  // Per-category detail for the expansion panel. Throws CATEGORY_NOT_FOUND
  // when the eventWeightCategoryId isn't in the computed map (wrong event,
  // bad id, etc). Cherry-picks the relevant fields from the computed category
  // record into the response shape.
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
        hasAgeGroupMove: category.hasAgeGroupMove,
        reviewed: category.reviewed,
        reviewedAt: category.reviewedAt,
        reviewedByName: category.reviewedByName,
        issues: category.issues,
      },
      eligibleAthletes: category.eligibleAthletes,
      excludedAthletes: category.excludedAthletes,
    };
  }
}
