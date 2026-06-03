import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildBracketOrCompetitionViewModel,
  computeCategoryResults,
  type CategoryPlacementRow,
  type CompetitionAthlete,
  type CompetitionFight,
  type CompetitionValidationIssue,
  type RoundRobinStandingRow,
} from '../competition/competition.logic';
import { resolveCompetitionFormat } from '../draw/competition-format';
import { roundStageLabel } from '../draw/brackets.helpers';

type CategorySummaryRow = {
  eventWeightCategoryId: string;
  categoryCode: string;
  categoryName: string;
  ageGroupName: string | null;
  competitionFormat: 'DIRECT_FINAL' | 'ROUND_ROBIN' | 'SINGLE_ELIMINATION';
  athleteCount: number;
  totalFights: number;
  completedFights: number;
  completionState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';
  needsReview: boolean;
  issues: CompetitionValidationIssue[];
  placements: CategoryPlacementRow[];
  standings: RoundRobinStandingRow[] | null;
  medalists: {
    gold: CategoryPlacementRow | null;
    silver: CategoryPlacementRow | null;
    bronze: CategoryPlacementRow[];
  };
  finalFight: {
    id: string;
    round: number;
    boutNo: number;
    stageLabel: string;
    status: string;
    winnerAthleteId: string | null;
    winMethod: string | null;
    notes: string | null;
    redAthleteId: string | null;
    blueAthleteId: string | null;
    redAthleteName: string | null;
    blueAthleteName: string | null;
  } | null;
};

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(organisationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      select: { id: true },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    return this.prisma.fight.findMany({
      where: {
        organisationId,
        eventId,
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        mat: { select: { id: true, name: true } },
      },
      orderBy: [{ categoryCode: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
    });
  }

  async summaryForEvent(organisationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      select: { id: true, bronzePolicyCode: true },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const [fights, registrations] = await Promise.all([
      this.prisma.fight.findMany({
        where: { organisationId, eventId },
        include: {
          redAthlete: { select: { id: true, firstName: true, lastName: true } },
          blueAthlete: {
            select: { id: true, firstName: true, lastName: true },
          },
          winnerAthlete: {
            select: { id: true, firstName: true, lastName: true },
          },
          eventWeightCategory: {
            select: {
              id: true,
              categoryTemplateWeight: { select: { name: true } },
              eventAgeGroup: {
                select: {
                  categoryTemplateAgeGroup: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { eventWeightCategoryId: 'asc' },
          { round: 'asc' },
          { boutNo: 'asc' },
        ],
      }),
      this.prisma.registration.findMany({
        where: { organisationId, eventId },
        select: {
          athleteId: true,
          eventWeightCategoryId: true,
          clubId: true,
          club: { select: { name: true } },
          athlete: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const athleteClubById = new Map(
      registrations.map((row) => [
        row.athleteId,
        {
          clubId: row.clubId,
          clubName: row.club?.name ?? 'Unknown club',
        },
      ]),
    );

    const registrationsByCategory = new Map<string, CompetitionAthlete[]>();
    for (const row of registrations) {
      if (!row.eventWeightCategoryId) continue;
      const bucket =
        registrationsByCategory.get(row.eventWeightCategoryId) ?? [];
      bucket.push({
        athleteId: row.athleteId,
        athleteName: `${row.athlete.firstName} ${row.athlete.lastName}`,
      });
      registrationsByCategory.set(row.eventWeightCategoryId, bucket);
    }

    const fightsByCategory = new Map<string, typeof fights>();
    for (const fight of fights) {
      if (!fight.eventWeightCategoryId) continue;
      const bucket = fightsByCategory.get(fight.eventWeightCategoryId) ?? [];
      bucket.push(fight);
      fightsByCategory.set(fight.eventWeightCategoryId, bucket);
    }

    const categories: CategorySummaryRow[] = [...fightsByCategory.entries()]
      .map(([eventWeightCategoryId, categoryFights]) => {
        const athletes =
          registrationsByCategory.get(eventWeightCategoryId) ?? [];
        const categoryName =
          categoryFights[0]?.eventWeightCategory?.categoryTemplateWeight
            ?.name ??
          categoryFights[0]?.categoryCode ??
          eventWeightCategoryId;
        const ageGroupName =
          categoryFights[0]?.eventWeightCategory?.eventAgeGroup
            ?.categoryTemplateAgeGroup?.name ?? null;

        const competitionFights: CompetitionFight[] = categoryFights.map(
          (fight) => ({
            id: fight.id,
            round: fight.round,
            boutNo: fight.boutNo,
            status: fight.status,
            redAthleteId: fight.redAthleteId ?? null,
            blueAthleteId: fight.blueAthleteId ?? null,
            winnerAthleteId: fight.winnerAthleteId ?? null,
            winMethod: fight.winMethod ?? null,
            notes: fight.notes ?? null,
          }),
        );

        const athleteById = new Map<string, string>();
        for (const athlete of athletes) {
          athleteById.set(athlete.athleteId, athlete.athleteName);
        }
        for (const fight of categoryFights) {
          if (fight.redAthlete) {
            athleteById.set(
              fight.redAthlete.id,
              `${fight.redAthlete.firstName} ${fight.redAthlete.lastName}`,
            );
          }
          if (fight.blueAthlete) {
            athleteById.set(
              fight.blueAthlete.id,
              `${fight.blueAthlete.firstName} ${fight.blueAthlete.lastName}`,
            );
          }
        }

        const uniqueAthleteCount = athleteById.size;
        const format = resolveCompetitionFormat({
          athleteCount: uniqueAthleteCount,
        });
        const athleteRows = [...athleteById.entries()].map(
          ([athleteId, athleteName]) => ({
            athleteId,
            athleteName,
          }),
        );

        const viewModel = buildBracketOrCompetitionViewModel({
          format,
          fights: competitionFights,
          athletes: athleteRows,
        });
        const categoryResults = computeCategoryResults({
          format,
          fights: competitionFights,
          athletes: athleteRows,
          bronzePolicy: event.bronzePolicyCode,
        });

        const highestRound = competitionFights.reduce(
          (max, fight) => Math.max(max, fight.round),
          0,
        );
        const finalFightRaw =
          [...competitionFights]
            .filter((fight) => fight.round === highestRound)
            .sort((a, b) => a.boutNo - b.boutNo)[0] ?? null;

        const finalFight = finalFightRaw
          ? {
              id: finalFightRaw.id,
              round: finalFightRaw.round,
              boutNo: finalFightRaw.boutNo,
              stageLabel: roundStageLabel(
                finalFightRaw.round,
                highestRound,
                format,
              ),
              status: finalFightRaw.status,
              winnerAthleteId: finalFightRaw.winnerAthleteId,
              winMethod: finalFightRaw.winMethod ?? null,
              notes: finalFightRaw.notes ?? null,
              redAthleteId: finalFightRaw.redAthleteId,
              blueAthleteId: finalFightRaw.blueAthleteId,
              redAthleteName: finalFightRaw.redAthleteId
                ? (athleteById.get(finalFightRaw.redAthleteId) ??
                  finalFightRaw.redAthleteId)
                : null,
              blueAthleteName: finalFightRaw.blueAthleteId
                ? (athleteById.get(finalFightRaw.blueAthleteId) ??
                  finalFightRaw.blueAthleteId)
                : null,
            }
          : null;

        return {
          eventWeightCategoryId,
          categoryCode:
            categoryFights[0]?.categoryCode ?? eventWeightCategoryId,
          categoryName,
          ageGroupName,
          competitionFormat: format,
          athleteCount: uniqueAthleteCount,
          totalFights: viewModel.totalFights,
          completedFights: viewModel.completedFights,
          completionState: viewModel.completionState,
          needsReview: viewModel.needsReview,
          issues: viewModel.issues,
          placements: categoryResults.placements,
          standings: categoryResults.standings,
          medalists: categoryResults.medalists,
          finalFight,
        };
      })
      .sort((a, b) => {
        const byAgeGroup = (a.ageGroupName ?? '').localeCompare(
          b.ageGroupName ?? '',
        );
        if (byAgeGroup !== 0) return byAgeGroup;
        return a.categoryName.localeCompare(b.categoryName);
      });

    const medalTable = buildMedalTable({
      placements: categories.flatMap((category) =>
        category.placements.filter(
          (row) => row.medal !== null && row.athleteId,
        ),
      ),
      athleteClubById,
    });

    return {
      policy: { bronzePolicyCode: event.bronzePolicyCode },
      categories,
      medalTable,
    };
  }
}

function buildMedalTable(input: {
  placements: CategoryPlacementRow[];
  athleteClubById: Map<string, { clubId: string | null; clubName: string }>;
}): Array<{
  clubId: string | null;
  clubName: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}> {
  const medalMap = new Map<
    string,
    {
      clubId: string | null;
      clubName: string;
      gold: number;
      silver: number;
      bronze: number;
      total: number;
    }
  >();

  const add = (
    athleteId: string | null,
    medal: 'gold' | 'silver' | 'bronze',
  ) => {
    if (!athleteId) return;
    const club = input.athleteClubById.get(athleteId) ?? {
      clubId: null,
      clubName: 'Unknown club',
    };
    const key = `${club.clubId ?? 'none'}:${club.clubName}`;
    const row = medalMap.get(key) ?? {
      clubId: club.clubId,
      clubName: club.clubName,
      gold: 0,
      silver: 0,
      bronze: 0,
      total: 0,
    };
    row[medal] += 1;
    row.total += 1;
    medalMap.set(key, row);
  };

  for (const placement of input.placements) {
    if (!placement.athleteId || !placement.medal) continue;
    if (placement.medal === 'GOLD') add(placement.athleteId, 'gold');
    if (placement.medal === 'SILVER') add(placement.athleteId, 'silver');
    if (placement.medal === 'BRONZE') add(placement.athleteId, 'bronze');
  }

  return [...medalMap.values()].sort(
    (a, b) =>
      b.gold - a.gold ||
      b.silver - a.silver ||
      b.bronze - a.bronze ||
      a.clubName.localeCompare(b.clubName),
  );
}
