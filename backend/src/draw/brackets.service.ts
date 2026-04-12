import { Injectable } from '@nestjs/common';
import type { FightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DrawReadinessService } from './draw.readiness.service';
import type { DrawCategoryComputedRow } from './draw.readiness.types';
import {
  deriveBracketCategoryStatus,
  derivePublicationStatus,
  detectCategoryIntegrityIssues,
  extractScoreToken,
  fightStateCounters,
  isEventPublished,
  roundStageLabel,
} from './brackets.helpers';
import { resolveCompetitionFormat } from './competition-format';
import { resolveBracketParticipantSlot } from './bracket-slot-resolver';
import type {
  BracketCategoryDetailsResponse,
  BracketFightListRow,
  BracketsOverviewCategoryRow,
  BracketsOverviewResponse,
  BracketRoundColumn,
} from './brackets.types';

const BRACKET_AUDIT_ACTIONS = [
  'DRAW_EXECUTED',
  'DRAW_REGENERATED',
  'BRACKETS_PUBLISHED',
  'EVENT_PUBLISHED',
  'EVENT_UNPUBLISHED',
] as const;

type FightOverviewRow = {
  id: string;
  round: number;
  boutNo: number;
  status: FightStatus;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId: string | null;
  eventWeightCategoryId: string | null;
  updatedAt: Date;
};

@Injectable()
export class BracketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readiness: DrawReadinessService,
  ) {}

  async getOverview(input: {
    organisationId: string;
    eventId: string;
  }): Promise<BracketsOverviewResponse> {
    const computed = await this.readiness.computeOverview(input);

    const [eventRow, fights, recentAudit] = await Promise.all([
      this.prisma.event.findFirst({
        where: { id: input.eventId, organisationId: input.organisationId },
        select: {
          id: true,
          name: true,
          lifecycle: true,
          published: true,
          publishTimingPolicyCode: true,
        },
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          eventWeightCategoryId: { not: null },
        },
        select: {
          id: true,
          round: true,
          boutNo: true,
          status: true,
          redAthleteId: true,
          blueAthleteId: true,
          winnerAthleteId: true,
          eventWeightCategoryId: true,
          updatedAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          action: { in: [...BRACKET_AUDIT_ACTIONS] },
        },
        select: {
          id: true,
          action: true,
          createdAt: true,
          actorUserId: true,
          reason: true,
          override: true,
          actor: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    if (!eventRow) {
      throw new Error('EVENT_NOT_FOUND');
    }

    const eventPublished = isEventPublished({
      lifecycle: eventRow.lifecycle,
      published: eventRow.published,
    });

    const fightsByCategory = new Map<string, FightOverviewRow[]>();
    for (const fight of fights) {
      if (!fight.eventWeightCategoryId) continue;
      const bucket = fightsByCategory.get(fight.eventWeightCategoryId) ?? [];
      bucket.push(fight);
      fightsByCategory.set(fight.eventWeightCategoryId, bucket);
    }

    const hasAnyBracketInEvent = fights.length > 0;
    const categories = computed.overview.categories.map((category) => {
      const fullCategory = computed.categoriesById.get(category.id);
      const categoryFights = fightsByCategory.get(category.id) ?? [];
      return this.toOverviewCategoryRow({
        category: fullCategory,
        categoryFights,
        hasAnyBracketInEvent,
        eventPublished,
      });
    });

    const athleteSet = new Set<string>();
    let totalByes = 0;
    let movedUpAthletesCount = 0;
    let categoriesWithBrackets = 0;
    let publishedCategoriesCount = 0;
    let needsReviewCategoriesCount = 0;
    let lastUpdatedAt: Date | null = null;

    for (const category of categories) {
      if (category.fightCount > 0) {
        categoriesWithBrackets += 1;
        if (category.publicationStatus === 'PUBLISHED') {
          publishedCategoriesCount += 1;
        }
      }
      if (category.status === 'NEEDS_REVIEW') {
        needsReviewCategoriesCount += 1;
      }
      totalByes += category.byesCount;
      movedUpAthletesCount += category.movedUpAthletesCount;
      if (category.updatedAt && (!lastUpdatedAt || category.updatedAt > lastUpdatedAt)) {
        lastUpdatedAt = category.updatedAt;
      }
    }

    for (const fight of fights) {
      if (fight.redAthleteId) athleteSet.add(fight.redAthleteId);
      if (fight.blueAthleteId) athleteSet.add(fight.blueAthleteId);
    }

    const canPublish = categoriesWithBrackets > 0 && !eventPublished;
    const canUnpublish = categoriesWithBrackets > 0 && eventPublished;

    return {
      event: {
        id: eventRow.id,
        name: eventRow.name,
        lifecycle: eventRow.lifecycle,
        drawStatus: computed.overview.event.drawStatus,
        publishTimingPolicyCode: eventRow.publishTimingPolicyCode,
        published: eventPublished,
      },
      summary: {
        totalCategories: categories.length,
        categoriesWithBrackets,
        publishedCategoriesCount,
        unpublishedCategoriesCount: categoriesWithBrackets - publishedCategoriesCount,
        totalAthletesInBrackets: athleteSet.size,
        totalByes,
        movedUpAthletesCount,
        needsReviewCategoriesCount,
      },
      actions: {
        canPublish,
        canUnpublish,
        canExport: categoriesWithBrackets > 0,
        publishBlockedReasonCode: canPublish
          ? null
          : categoriesWithBrackets <= 0
            ? 'NO_GENERATED_BRACKETS'
            : 'ALREADY_PUBLISHED',
        unpublishBlockedReasonCode: canUnpublish
          ? null
          : categoriesWithBrackets <= 0
            ? 'NO_GENERATED_BRACKETS'
            : 'ALREADY_UNPUBLISHED',
      },
      lastUpdated: {
        at: lastUpdatedAt,
        by: recentAudit[0]?.actorUserId
          ? {
              id: recentAudit[0].actorUserId,
              displayName: recentAudit[0].actor?.displayName ?? null,
            }
          : null,
      },
      audit: {
        recent: recentAudit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt,
          actorUserId: entry.actorUserId,
          actorDisplayName: entry.actor?.displayName ?? null,
          reason: entry.reason,
          override: entry.override,
        })),
      },
      categories,
    };
  }

  async getCategoryDetails(input: {
    organisationId: string;
    eventId: string;
    eventWeightCategoryId: string;
  }): Promise<BracketCategoryDetailsResponse> {
    const computed = await this.readiness.computeOverview({
      organisationId: input.organisationId,
      eventId: input.eventId,
    });

    const category = computed.categoriesById.get(input.eventWeightCategoryId);
    if (!category) throw new Error('CATEGORY_NOT_FOUND');

    const [eventRow, fights] = await Promise.all([
      this.prisma.event.findFirst({
        where: { id: input.eventId, organisationId: input.organisationId },
        select: { id: true, name: true, lifecycle: true, published: true },
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          eventWeightCategoryId: input.eventWeightCategoryId,
        },
        include: {
          redAthlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              documentId: true,
              club: { select: { name: true, country: true } },
            },
          },
          blueAthlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              documentId: true,
              club: { select: { name: true, country: true } },
            },
          },
          mat: { select: { name: true } },
        },
        orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
      }),
    ]);

    if (!eventRow) throw new Error('EVENT_NOT_FOUND');

    const eventPublished = isEventPublished({
      lifecycle: eventRow.lifecycle,
      published: eventRow.published,
    });

    const overviewCategory = this.toOverviewCategoryRow({
      category,
      categoryFights: fights,
      hasAnyBracketInEvent: computed.overview.event.drawStatus !== 'NOT_GENERATED',
      eventPublished,
    });

    const athleteMeta = new Map(
      [...category.eligibleAthletes, ...category.excludedAthletes].map((row) => [
        row.athleteId,
        row,
      ]),
    );

    const roundsMap = new Map<number, BracketRoundColumn['matchups']>();
    const rounds = fights.map((fight) => fight.round);
    const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
    const openingRound = rounds.length > 0 ? Math.min(...rounds) : 0;
    const competitionFormat = overviewCategory.competitionFormat;
    const fightsByRoundBout = new Map(
      fights.map((fight) => [`${fight.round}:${fight.boutNo}`, fight]),
    );

    const fightRows: BracketFightListRow[] = [];

    for (const fight of fights) {
      const redMeta =
        fight.redAthleteId != null ? athleteMeta.get(fight.redAthleteId) : undefined;
      const blueMeta =
        fight.blueAthleteId != null
          ? athleteMeta.get(fight.blueAthleteId)
          : undefined;

      const redParticipant =
        fight.redAthlete == null
          ? null
          : {
              athleteId: fight.redAthlete.id,
              athleteName: `${fight.redAthlete.firstName} ${fight.redAthlete.lastName}`,
              clubName: fight.redAthlete.club?.name ?? redMeta?.clubName ?? null,
              country: fight.redAthlete.club?.country ?? null,
              athleteCode:
                fight.redAthlete.documentId ?? redMeta?.athleteCode ?? fight.redAthlete.id,
              movedUp: redMeta?.movedUp ?? false,
              overrideUsed: redMeta?.overrideUsed ?? false,
              originalCategory: redMeta?.originalCategory ?? null,
              finalCategory: redMeta?.finalCategory ?? overviewCategory.categoryName,
            };
      const blueParticipant =
        fight.blueAthlete == null
          ? null
          : {
              athleteId: fight.blueAthlete.id,
              athleteName: `${fight.blueAthlete.firstName} ${fight.blueAthlete.lastName}`,
              clubName: fight.blueAthlete.club?.name ?? blueMeta?.clubName ?? null,
              country: fight.blueAthlete.club?.country ?? null,
              athleteCode:
                fight.blueAthlete.documentId ??
                blueMeta?.athleteCode ??
                fight.blueAthlete.id,
              movedUp: blueMeta?.movedUp ?? false,
              overrideUsed: blueMeta?.overrideUsed ?? false,
              originalCategory: blueMeta?.originalCategory ?? null,
              finalCategory: blueMeta?.finalCategory ?? overviewCategory.categoryName,
            };
      const redSlot = resolveBracketParticipantSlot({
        side: 'red',
        fight,
        participant: redParticipant,
        competitionFormat,
        openingRound,
        getSourceFight: (sourceBoutNo) =>
          fightsByRoundBout.get(`${fight.round - 1}:${sourceBoutNo}`) ?? null,
      });
      const blueSlot = resolveBracketParticipantSlot({
        side: 'blue',
        fight,
        participant: blueParticipant,
        competitionFormat,
        openingRound,
        getSourceFight: (sourceBoutNo) =>
          fightsByRoundBout.get(`${fight.round - 1}:${sourceBoutNo}`) ?? null,
      });

      const matchup = {
        fightId: fight.id,
        boutNo: fight.boutNo,
        round: fight.round,
        status: fight.status,
        winMethod: fight.winMethod,
        score: extractScoreToken(fight.notes),
        winnerAthleteId: fight.winnerAthleteId,
        isBye: redSlot.kind === 'BYE' || blueSlot.kind === 'BYE',
        orderInMat: fight.orderInMat,
        scheduledStartTime: fight.scheduledStartTime,
        matName: fight.mat?.name ?? null,
        participants: {
          red: redParticipant,
          blue: blueParticipant,
        },
        slots: {
          red: redSlot,
          blue: blueSlot,
        },
      };

      const bucket = roundsMap.get(fight.round) ?? [];
      bucket.push(matchup);
      roundsMap.set(fight.round, bucket);

      fightRows.push({
        id: fight.id,
        boutNo: fight.boutNo,
        round: fight.round,
        stageLabel: roundStageLabel(
          fight.round,
          maxRound,
          competitionFormat,
        ),
        status: fight.status,
        winMethod: fight.winMethod,
        score: extractScoreToken(fight.notes),
        winnerAthleteId: fight.winnerAthleteId,
        redAthleteId: fight.redAthleteId,
        blueAthleteId: fight.blueAthleteId,
        redAthleteName: redParticipant?.athleteName ?? null,
        blueAthleteName: blueParticipant?.athleteName ?? null,
        redSlot,
        blueSlot,
        scheduledStartTime: fight.scheduledStartTime,
        matName: fight.mat?.name ?? null,
        orderInMat: fight.orderInMat,
      });
    }

    const roundColumns = [...roundsMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, matchups]) => ({
        round,
        label: roundStageLabel(round, maxRound, competitionFormat),
        matchups: matchups.sort((a, b) => a.boutNo - b.boutNo),
      }));

    const fightStatuses = fights.map((fight) => fight.status);
    const counters = fightStateCounters(fightStatuses);

    return {
      event: {
        id: eventRow.id,
        name: eventRow.name,
        lifecycle: eventRow.lifecycle,
        drawStatus: computed.overview.event.drawStatus,
        published: eventPublished,
      },
      category: overviewCategory,
      summary: {
        totalAthletes: overviewCategory.athleteCount,
        totalFights: fights.length,
        completedFights: counters.completed,
        inProgressFights: counters.inProgress,
        byesCount: overviewCategory.byesCount,
        semifinalCount:
          competitionFormat === 'ROUND_ROBIN'
            ? 0
            : fights.filter((fight) => fight.round === maxRound - 1).length,
        finalCount:
          competitionFormat === 'ROUND_ROBIN'
            ? 0
            : fights.filter((fight) => fight.round === maxRound).length,
        movedUpAthletesCount: overviewCategory.movedUpAthletesCount,
        bronzePolicy: 'TWO_BRONZES',
      },
      rounds: roundColumns,
      fights: fightRows,
      athletes: {
        eligible: category.eligibleAthletes,
        excluded: category.excludedAthletes,
      },
      actions: {
        canPublish: !eventPublished && overviewCategory.fightCount > 0,
        canUnpublish: eventPublished && overviewCategory.fightCount > 0,
      },
    };
  }

  async swapParticipants(input: {
    organisationId: string;
    eventId: string;
    fightId1: string;
    side1: 'red' | 'blue';
    fightId2: string;
    side2: 'red' | 'blue';
  }): Promise<void> {
    const field1 = input.side1 === 'red' ? 'redAthleteId' : 'blueAthleteId';
    const field2 = input.side2 === 'red' ? 'redAthleteId' : 'blueAthleteId';

    const [fight1, fight2] = await Promise.all([
      this.prisma.fight.findFirst({
        where: { id: input.fightId1, eventId: input.eventId, organisationId: input.organisationId },
        select: { id: true, redAthleteId: true, blueAthleteId: true, winnerAthleteId: true },
      }),
      this.prisma.fight.findFirst({
        where: { id: input.fightId2, eventId: input.eventId, organisationId: input.organisationId },
        select: { id: true, redAthleteId: true, blueAthleteId: true, winnerAthleteId: true },
      }),
    ]);

    if (!fight1 || !fight2) throw new Error('FIGHT_NOT_FOUND');
    if (input.fightId1 === input.fightId2 && input.side1 === input.side2) {
      throw new Error('SWAP_SAME_SLOT');
    }

    const athleteId1 = fight1[field1 as keyof typeof fight1] as string | null;
    const athleteId2 = fight2[field2 as keyof typeof fight2] as string | null;

    await this.prisma.$transaction([
      this.prisma.fight.update({
        where: { id: fight1.id },
        data: {
          [field1]: athleteId2,
          // Clear winner if the swapped athlete was the winner
          winnerAthleteId: fight1.winnerAthleteId != null ? null : undefined,
          loserAthleteId: null,
          winMethod: fight1.winnerAthleteId != null ? null : undefined,
          confirmedAt: fight1.winnerAthleteId != null ? null : undefined,
          status: fight1.winnerAthleteId != null ? 'PENDING' : undefined,
        },
      }),
      this.prisma.fight.update({
        where: { id: fight2.id },
        data: {
          [field2]: athleteId1,
          winnerAthleteId: fight2.winnerAthleteId != null ? null : undefined,
          loserAthleteId: null,
          winMethod: fight2.winnerAthleteId != null ? null : undefined,
          confirmedAt: fight2.winnerAthleteId != null ? null : undefined,
          status: fight2.winnerAthleteId != null ? 'PENDING' : undefined,
        },
      }),
    ]);
  }

  private toOverviewCategoryRow(input: {
    category: DrawCategoryComputedRow | undefined;
    categoryFights: Array<FightOverviewRow>;
    hasAnyBracketInEvent: boolean;
    eventPublished: boolean;
  }): BracketsOverviewCategoryRow {
    if (!input.category) {
      throw new Error('CATEGORY_NOT_FOUND');
    }

    const athleteIds = new Set<string>();
    let byesCount = 0;
    let hasInvalidBlankFights = false;
    let completeWithoutWinner = false;
    let hasRoundRobinByes = false;

    for (const fight of input.categoryFights) {
      if (fight.redAthleteId) athleteIds.add(fight.redAthleteId);
      if (fight.blueAthleteId) athleteIds.add(fight.blueAthleteId);

      if (
        (fight.status === 'COMPLETE' || fight.status === 'CONFIRMED') &&
        !fight.winnerAthleteId
      ) {
        completeWithoutWinner = true;
      }
      if (
        (fight.redAthleteId == null && fight.blueAthleteId != null) ||
        (fight.redAthleteId != null && fight.blueAthleteId == null)
      ) {
        byesCount += 1;
      }
    }

    const rounds = input.categoryFights.map((fight) => fight.round);
    const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
    const openingRound = rounds.length > 0 ? Math.min(...rounds) : 0;
    const competitionFormat = resolveCompetitionFormat({
      eligibleAthletesCount: input.category.eligibleAthletesCount,
    });

    for (const fight of input.categoryFights) {
      const isBlank = !fight.redAthleteId && !fight.blueAthleteId;
      const hasSingleSide =
        (fight.redAthleteId == null && fight.blueAthleteId != null) ||
        (fight.redAthleteId != null && fight.blueAthleteId == null);
      if (competitionFormat === 'ROUND_ROBIN') {
        if (isBlank || hasSingleSide || fight.redAthleteId === fight.blueAthleteId) {
          hasRoundRobinByes = true;
        }
        if (isBlank) hasInvalidBlankFights = true;
        continue;
      }
      if (isBlank && fight.round === openingRound) {
        hasInvalidBlankFights = true;
      }
    }

    const finalFightCount = input.categoryFights.filter(
      (fight) => fight.round === maxRound,
    ).length;

    const openingRoundAthletes = new Map<string, number>();
    for (const fight of input.categoryFights) {
      if (fight.round !== openingRound) continue;
      if (fight.redAthleteId) {
        openingRoundAthletes.set(
          fight.redAthleteId,
          (openingRoundAthletes.get(fight.redAthleteId) ?? 0) + 1,
        );
      }
      if (fight.blueAthleteId) {
        openingRoundAthletes.set(
          fight.blueAthleteId,
          (openingRoundAthletes.get(fight.blueAthleteId) ?? 0) + 1,
        );
      }
    }

    const duplicateAthleteInOpeningRound = Array.from(openingRoundAthletes.values()).some(
      (count) => count > 1,
    );

    const activeAthleteSlots = new Map<string, number>();
    for (const fight of input.categoryFights) {
      if (fight.status === 'COMPLETE' || fight.status === 'CONFIRMED') continue;
      if (fight.redAthleteId) {
        activeAthleteSlots.set(
          fight.redAthleteId,
          (activeAthleteSlots.get(fight.redAthleteId) ?? 0) + 1,
        );
      }
      if (fight.blueAthleteId) {
        activeAthleteSlots.set(
          fight.blueAthleteId,
          (activeAthleteSlots.get(fight.blueAthleteId) ?? 0) + 1,
        );
      }
    }
    const duplicateAthleteInActiveFights = Array.from(
      activeAthleteSlots.values(),
    ).some((count) => count > 1);

    let hasRoundRobinMissingPairings = false;
    if (competitionFormat === 'ROUND_ROBIN') {
      const eligibleAthleteIds = new Set(
        input.category.eligibleAthletes.map((row) => row.athleteId),
      );
      const expectedPairings =
        (eligibleAthleteIds.size * (eligibleAthleteIds.size - 1)) / 2;
      const pairings = new Set<string>();
      let duplicatePairings = false;
      let validPairings = 0;

      for (const fight of input.categoryFights) {
        if (!fight.redAthleteId || !fight.blueAthleteId) continue;
        if (fight.redAthleteId === fight.blueAthleteId) continue;
        const [a, b] = [fight.redAthleteId, fight.blueAthleteId].sort();
        const key = `${a}:${b}`;
        if (pairings.has(key)) {
          duplicatePairings = true;
          continue;
        }
        pairings.add(key);
        validPairings += 1;
      }

      hasRoundRobinMissingPairings =
        input.categoryFights.length !== expectedPairings ||
        validPairings !== expectedPairings ||
        pairings.size !== expectedPairings ||
        duplicatePairings;
    }

    const integrityIssues = detectCategoryIntegrityIssues({
      competitionFormat,
      hasFights: input.categoryFights.length > 0,
      hasInvalidBlankFights,
      completeWithoutWinner,
      hasMissingFinalRound:
        input.categoryFights.length > 0 &&
        competitionFormat !== 'ROUND_ROBIN' &&
        finalFightCount !== 1,
      duplicateAthleteInOpeningRound,
      duplicateAthleteInActiveFights,
      hasRoundRobinMissingPairings,
      hasRoundRobinByes,
    });

    const statusCounts = fightStateCounters(
      input.categoryFights.map((fight) => fight.status),
    );

    const status = deriveBracketCategoryStatus({
      hasFights: input.categoryFights.length > 0,
      totalFights: input.categoryFights.length,
      hasAnyBracketInEvent: input.hasAnyBracketInEvent,
      eligibleAthletesCount: input.category.eligibleAthletesCount,
      completedFightsCount: statusCounts.completed,
      inProgressFightsCount: statusCounts.inProgress,
      hasIntegrityIssue: integrityIssues.some((issue) => issue.severity === 'CRITICAL'),
      eventPublished: input.eventPublished,
    });

    const movedUpAthletesCount = input.category.eligibleAthletes.filter(
      (row) => row.movedUp,
    ).length;

    let updatedAt: Date | null = null;
    for (const fight of input.categoryFights) {
      if (!updatedAt || fight.updatedAt > updatedAt) {
        updatedAt = fight.updatedAt;
      }
    }

    const baseIssues = input.category.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
    }));
    const missingDrawIssue =
      input.categoryFights.length === 0 &&
      input.hasAnyBracketInEvent &&
      input.category.eligibleAthletesCount > 0
        ? [{ code: 'CATEGORY_NOT_DRAWN', severity: 'CRITICAL' as const }]
        : [];

    return {
      id: input.category.id,
      ageGroupCode: input.category.ageGroupCode,
      ageGroupName: input.category.ageGroupName,
      division: input.category.division,
      categoryName: input.category.categoryName,
      sortOrder: input.category.sortOrder,
      competitionFormat,
      status,
      publicationStatus: derivePublicationStatus({
        hasFights: input.categoryFights.length > 0,
        eventPublished: input.eventPublished,
      }),
      athleteCount: athleteIds.size,
      eligibleAthletesCount: input.category.eligibleAthletesCount,
      fightCount: input.categoryFights.length,
      byesCount,
      movedUpAthletesCount,
      issueCount: baseIssues.length + integrityIssues.length + missingDrawIssue.length,
      issues: [...baseIssues, ...integrityIssues, ...missingDrawIssue],
      updatedAt,
    };
  }
}
