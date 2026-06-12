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
import {
  buildPublicClubStandings,
  buildPublicPlacements,
} from './public-results.logic';
import {
  bucketKey,
  fullName,
  fullNameKa,
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
        redAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameKa: true,
            lastNameKa: true,
          },
        },
        blueAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameKa: true,
            lastNameKa: true,
          },
        },
        winnerAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameKa: true,
            lastNameKa: true,
          },
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
        bracket: { select: { format: true } },
      },
      orderBy: [{ categoryCode: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
    });

    const registrations = await this.prisma.registration.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      select: {
        athleteId: true,
        clubId: true,
        club: { select: { name: true, nameKa: true } },
      },
    });

    const athleteClubById = new Map(
      registrations.map((row) => [
        row.athleteId,
        {
          clubId: row.clubId,
          clubName: row.club?.name ?? null,
          clubNameKa: row.club?.nameKa ?? null,
        },
      ]),
    );

    const athleteNameKaById = new Map<string, string | null>();
    for (const fight of fights) {
      if (fight.redAthlete)
        athleteNameKaById.set(
          fight.redAthlete.id,
          fullNameKa(fight.redAthlete),
        );
      if (fight.blueAthlete)
        athleteNameKaById.set(
          fight.blueAthlete.id,
          fullNameKa(fight.blueAthlete),
        );
    }

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

      // The bracket stores the format the draw actually used; count-based
      // inference remains only as a fallback for pre-format legacy fights.
      const competitionFormat =
        bucket[0]?.bracket?.format ??
        resolveCompetitionFormat({
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
          // BF-11: public standings/medals count CONFIRMED results only — a
          // COMPLETE-but-unconfirmed (provisional) outcome must not show.
          fight.status !== 'CONFIRMED' ||
          !fight.winnerAthleteId ||
          !fight.redAthleteId ||
          !fight.blueAthleteId ||
          fight.redAthleteId === fight.blueAthleteId
        ) {
          continue;
        }

        const winnerCorner =
          fight.winnerAthleteId === fight.redAthleteId ? 'RED' : 'BLUE';
        const redClub = athleteClubById.get(fight.redAthleteId);
        const blueClub = athleteClubById.get(fight.blueAthleteId);
        const winner =
          winnerCorner === 'RED'
            ? {
                athleteId: fight.redAthleteId,
                fullName: fullName(fight.redAthlete),
                fullNameKa: fullNameKa(fight.redAthlete),
                clubName: redClub?.clubName ?? null,
                clubNameKa: redClub?.clubNameKa ?? null,
                corner: 'RED' as const,
              }
            : {
                athleteId: fight.blueAthleteId,
                fullName: fullName(fight.blueAthlete),
                fullNameKa: fullNameKa(fight.blueAthlete),
                clubName: blueClub?.clubName ?? null,
                clubNameKa: blueClub?.clubNameKa ?? null,
                corner: 'BLUE' as const,
              };
        const opponent =
          winnerCorner === 'RED'
            ? {
                athleteId: fight.blueAthleteId,
                fullName: fullName(fight.blueAthlete),
                fullNameKa: fullNameKa(fight.blueAthlete),
                clubName: blueClub?.clubName ?? null,
                clubNameKa: blueClub?.clubNameKa ?? null,
                corner: 'BLUE' as const,
              }
            : {
                athleteId: fight.redAthleteId,
                fullName: fullName(fight.redAthlete),
                fullNameKa: fullNameKa(fight.redAthlete),
                clubName: redClub?.clubName ?? null,
                clubNameKa: redClub?.clubNameKa ?? null,
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
        athleteNameKaById,
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

    // The client's PublicResultsFeed consumes eventId/categories/clubs only.
    // The old top-level `fights` (raw rows) and `placements` (single-elim-only
    // logic that mis-medalled round-robin pools) were unconsumed payload — the
    // real per-category placements above go through computeCategoryResults,
    // which branches on the bracket's stored format.
    return {
      eventId: input.eventId,
      categories,
      clubs,
      medalTable,
    };
  }
}
