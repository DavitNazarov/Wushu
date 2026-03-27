import { Injectable } from '@nestjs/common';
import type { BronzePolicyCode } from '@prisma/client';
import {
  computeCategoryResults,
  type CompetitionAthlete,
  type CompetitionFight,
} from '../competition/competition.logic';
import { resolveCompetitionFormat } from '../draw/competition-format';
import { roundStageLabel } from '../draw/brackets.helpers';
import { PrismaService } from '../prisma/prisma.service';
import { buildPlacementsFromConfirmedFights } from '../results/results.logic';
import {
  buildPublicClubStandings,
  buildPublicPlacements,
} from './public-results.logic';
import {
  bucketKey,
  fullName,
  type PublicResultCategory,
  type PublicResultFight,
} from './public-results.types';

@Injectable()
export class PublicResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEventResults(input: {
    eventId: string;
    organisationId: string;
    bronzePolicyCode: BronzePolicyCode;
  }) {
    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
      },
      include: {
        mat: { select: { name: true } },
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        eventWeightCategory: {
          select: {
            categoryTemplateWeight: {
              select: { name: true, sortOrder: true },
            },
            eventAgeGroup: {
              select: {
                categoryTemplateAgeGroup: {
                  select: { name: true, sortOrder: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ categoryCode: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
    });

    const registrations = await this.prisma.registration.findMany({
      where: { eventId: input.eventId },
      select: {
        athleteId: true,
        clubId: true,
        club: { select: { name: true } },
      },
    });

    const athleteClubById = new Map(
      registrations.map((row) => [
        row.athleteId,
        { clubId: row.clubId, clubName: row.club?.name ?? null },
      ]),
    );

    const placements = buildPlacementsFromConfirmedFights(
      fights
        .filter((fight) => fight.status === 'CONFIRMED')
        .map((fight) => ({
          id: fight.id,
          categoryCode: fight.categoryCode,
          round: fight.round,
          boutNo: fight.boutNo,
          winnerAthleteId: fight.winnerAthleteId ?? null,
          redAthleteId: fight.redAthleteId ?? null,
          blueAthleteId: fight.blueAthleteId ?? null,
        })),
      input.bronzePolicyCode,
    );
    const fightsByBucket = new Map<string, typeof fights>();
    for (const fight of fights) {
      const key = bucketKey(fight);
      const bucket = fightsByBucket.get(key) ?? [];
      bucket.push(fight);
      fightsByBucket.set(key, bucket);
    }

    const groupedCategories = new Map<
      string,
      PublicResultCategory & {
        ageGroupSortOrder: number;
        weightSortOrder: number;
      }
    >();

    for (const [currentBucketKey, bucket] of fightsByBucket.entries()) {
      const athleteIds = new Set<string>();
      const maxRound = bucket.reduce(
        (max, fight) => Math.max(max, fight.round),
        0,
      );

      for (const fight of bucket) {
        if (fight.redAthleteId) athleteIds.add(fight.redAthleteId);
        if (fight.blueAthleteId) athleteIds.add(fight.blueAthleteId);
      }

      const competitionFormat = resolveCompetitionFormat({
        athleteCount: athleteIds.size,
      });
      const categoryName =
        bucket[0]?.eventWeightCategory?.categoryTemplateWeight?.name ??
        bucket[0]?.categoryCode ??
        currentBucketKey;
      const ageGroupName =
        bucket[0]?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
          ?.name ?? null;
      const ageGroupSortOrder =
        bucket[0]?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
          ?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const weightSortOrder =
        bucket[0]?.eventWeightCategory?.categoryTemplateWeight?.sortOrder ??
        Number.MAX_SAFE_INTEGER;

      const resultRows: PublicResultFight[] = [];
      const athleteNameById = new Map<string, string>();
      const competitionAthletes: CompetitionAthlete[] = [];
      const competitionFights: CompetitionFight[] = bucket.map((fight) => ({
        id: fight.id,
        round: fight.round,
        boutNo: fight.boutNo,
        status: fight.status,
        redAthleteId: fight.redAthleteId ?? null,
        blueAthleteId: fight.blueAthleteId ?? null,
        winnerAthleteId: fight.winnerAthleteId ?? null,
        winMethod: fight.winMethod ?? null,
        notes: fight.notes ?? null,
      }));

      for (const fight of bucket) {
        if (fight.redAthlete) {
          athleteNameById.set(fight.redAthlete.id, fullName(fight.redAthlete));
        }
        if (fight.blueAthlete) {
          athleteNameById.set(
            fight.blueAthlete.id,
            fullName(fight.blueAthlete),
          );
        }
      }
      for (const [athleteId, athleteName] of athleteNameById.entries()) {
        competitionAthletes.push({ athleteId, athleteName });
      }

      for (const fight of bucket) {
        if (
          (fight.status !== 'COMPLETE' && fight.status !== 'CONFIRMED') ||
          !fight.winnerAthleteId ||
          !fight.redAthleteId ||
          !fight.blueAthleteId ||
          fight.redAthleteId === fight.blueAthleteId
        ) {
          continue;
        }

        const winnerCorner =
          fight.winnerAthleteId === fight.redAthleteId ? 'RED' : 'BLUE';
        const winner =
          winnerCorner === 'RED'
            ? {
                athleteId: fight.redAthleteId,
                fullName: fullName(fight.redAthlete),
                clubName:
                  athleteClubById.get(fight.redAthleteId)?.clubName ?? null,
                corner: 'RED' as const,
              }
            : {
                athleteId: fight.blueAthleteId,
                fullName: fullName(fight.blueAthlete),
                clubName:
                  athleteClubById.get(fight.blueAthleteId)?.clubName ?? null,
                corner: 'BLUE' as const,
              };
        const opponent =
          winnerCorner === 'RED'
            ? {
                athleteId: fight.blueAthleteId,
                fullName: fullName(fight.blueAthlete),
                clubName:
                  athleteClubById.get(fight.blueAthleteId)?.clubName ?? null,
                corner: 'BLUE' as const,
              }
            : {
                athleteId: fight.redAthleteId,
                fullName: fullName(fight.redAthlete),
                clubName:
                  athleteClubById.get(fight.redAthleteId)?.clubName ?? null,
                corner: 'RED' as const,
              };

        resultRows.push({
          id: fight.id,
          status: fight.status,
          stageCode: roundStageLabel(fight.round, maxRound, competitionFormat),
          round: fight.round,
          boutNo: fight.boutNo,
          scheduleOrder: fight.orderInMat ?? null,
          matName: fight.mat?.name ?? null,
          scheduledAt: fight.scheduledStartTime ?? null,
          method: fight.winMethod ?? null,
          notes: fight.notes ?? null,
          winner,
          opponent,
        });
      }

      if (resultRows.length === 0) continue;

      const categoryResults = computeCategoryResults({
        format: competitionFormat,
        fights: competitionFights,
        athletes: competitionAthletes,
        bronzePolicy:
          input.bronzePolicyCode === 'TWO_BRONZES' ? 'TWO_BRONZES' : undefined,
      });
      const placements = buildPublicPlacements({
        placements: categoryResults.placements,
        athleteClubById,
        isComplete: categoryResults.isComplete,
      });

      groupedCategories.set(currentBucketKey, {
        categoryCode: bucket[0]?.categoryCode ?? currentBucketKey,
        categoryName,
        ageGroupName,
        resultCount: resultRows.length,
        placements,
        results: resultRows.sort(
          (left, right) =>
            right.round - left.round ||
            (left.scheduleOrder ?? Number.MAX_SAFE_INTEGER) -
              (right.scheduleOrder ?? Number.MAX_SAFE_INTEGER) ||
            left.boutNo - right.boutNo,
        ),
        ageGroupSortOrder,
        weightSortOrder,
      });
    }

    const categories = [...groupedCategories.values()]
      .sort(
        (left, right) =>
          left.ageGroupSortOrder - right.ageGroupSortOrder ||
          left.weightSortOrder - right.weightSortOrder ||
          left.categoryName.localeCompare(right.categoryName),
      )
      .map((category) => ({
        categoryCode: category.categoryCode,
        categoryName: category.categoryName,
        ageGroupName: category.ageGroupName,
        resultCount: category.resultCount,
        placements: category.placements,
        results: category.results,
      }));
    const clubs = buildPublicClubStandings({ categories, athleteClubById });
    const medalTable = clubs.map((club) => ({
      clubId: club.clubId,
      clubName: club.clubName ?? 'Unknown club',
      gold: club.gold,
      silver: club.silver,
      bronze: club.bronze,
      total: club.total,
    }));

    return {
      eventId: input.eventId,
      categories,
      clubs,
      fights: fights.filter(
        (fight) => fight.status === 'COMPLETE' || fight.status === 'CONFIRMED',
      ),
      placements,
      medalTable,
    };
  }
}
