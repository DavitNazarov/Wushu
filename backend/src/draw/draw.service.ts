import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  buildRoundRobinBracket,
  buildSingleElimBracket,
  seededShuffle,
} from './draw.utils';
import { isEventReadOnly } from '../events/lifecycle-rules';
import { DrawReadinessService } from './draw.readiness.service';
import { resolveCompetitionFormat } from './competition-format';

function toBracketCategoryCode(input: {
  ageGroupCode: string;
  sex: 'MALE' | 'FEMALE' | null;
  weightName: string;
  eventWeightCategoryId: string;
}): string {
  const age = input.ageGroupCode.trim().toUpperCase();
  const division = input.sex === 'FEMALE' ? 'F' : input.sex === 'MALE' ? 'M' : 'X';
  const weight = input.weightName.trim().replace(/\s+/g, '_').toUpperCase();

  // Keep code readable but guarantee uniqueness per event category.
  return `${age}_${division}_${weight}_${input.eventWeightCategoryId}`;
}

@Injectable()
export class DrawService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly readiness: DrawReadinessService,
  ) {}

  private async hasUnsafeCompetitionProgress(input: {
    organisationId: string;
    eventId: string;
  }): Promise<boolean> {
    const progressedFight = await this.prisma.fight.findFirst({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        redAthleteId: { not: null },
        blueAthleteId: { not: null },
        OR: [
          { status: { in: ['ON_DECK', 'IN_PROGRESS', 'PAUSED', 'COMPLETE', 'CONFIRMED'] } },
          { winnerAthleteId: { not: null } },
          { loserAthleteId: { not: null } },
          { winMethod: { not: null } },
          { confirmedAt: { not: null } },
        ],
      },
      select: { id: true },
    });
    if (progressedFight) {
      return true;
    }

    const activeTimer = await this.prisma.timerState.findFirst({
      where: {
        organisationId: input.organisationId,
        state: { in: ['RUNNING', 'PAUSED'] },
        fight: { eventId: input.eventId },
      },
      select: { fightId: true },
    });

    return Boolean(activeTimer);
  }

  async executeDraw(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    seed?: number;
    sameClubSeparation?: boolean;
    override?: boolean;
    reason?: string | null;
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    if (isEventReadOnly(event.lifecycle) && !input.override) {
      throw new Error('EVENT_READ_ONLY');
    }
    if (input.override && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const existingBracketCount = await this.prisma.bracket.count({
      where: { organisationId: input.organisationId, eventId: input.eventId },
    });
    if (existingBracketCount > 0 && !input.override) {
      throw new Error('DRAW_ALREADY_EXISTS');
    }
    if (existingBracketCount > 0) {
      const unsafeProgress = await this.hasUnsafeCompetitionProgress({
        organisationId: input.organisationId,
        eventId: input.eventId,
      });
      if (
        unsafeProgress ||
        event.published ||
        event.lifecycle === 'LIVE' ||
        event.lifecycle === 'COMPLETED'
      ) {
        throw new Error('DRAW_MUTATION_BLOCKED');
      }
    }

    const readiness = await this.readiness.getOverview({
      organisationId: input.organisationId,
      eventId: input.eventId,
    });
    if (!input.override) {
      const criticalCodes = new Set(
        readiness.validation.critical.map((issue) => issue.code),
      );
      if (criticalCodes.has('EVENT_NOT_LOCKED')) {
        throw new Error('EVENT_NOT_LOCKED');
      }
      if (criticalCodes.has('WEIGHIN_NOT_COMPLETED_FOR_DRAW')) {
        throw new Error('WEIGHIN_NOT_COMPLETED_FOR_DRAW');
      }
      if (readiness.summary.blockedCategoriesCount > 0) {
        throw new Error('DRAW_BLOCKED_CATEGORIES');
      }
      if (readiness.summary.readyCategoriesCount <= 0) {
        throw new Error('NO_READY_CATEGORIES');
      }
      if (readiness.validation.critical.length > 0) {
        throw new Error('DRAW_VALIDATION_FAILED');
      }
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        status: 'APPROVED',
        weighInStatus: { in: ['PASSED', 'MOVED_UP', 'OVERRIDE_APPROVED'] },
        eventWeightCategoryId: { not: null },
      },
      include: {
        athlete: { select: { id: true, clubId: true } },
        eventWeightCategory: {
          include: {
            rulesetWeightCategory: { select: { name: true } },
            eventAgeGroup: {
              include: {
                rulesetAgeGroup: {
                  select: {
                    code: true,
                    sex: true,
                    roundDurationSeconds: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (registrations.length === 0) {
      throw new Error('NO_ELIGIBLE_REGISTRATIONS');
    }

    type RegRow = (typeof registrations)[0];
    const byCat = new Map<
      string,
      {
        eventWeightCategoryId: string;
        categoryCode: string;
        roundDurationSeconds: number;
        regs: RegRow[];
      }
    >();

    for (const r of registrations) {
      if (!r.eventWeightCategoryId || !r.eventWeightCategory) continue;
      const key = r.eventWeightCategoryId;
      if (!byCat.has(key)) {
        byCat.set(key, {
          eventWeightCategoryId: key,
          categoryCode: toBracketCategoryCode({
            ageGroupCode: r.eventWeightCategory.eventAgeGroup.rulesetAgeGroup.code,
            sex: r.eventWeightCategory.eventAgeGroup.rulesetAgeGroup.sex,
            weightName: r.eventWeightCategory.rulesetWeightCategory.name,
            eventWeightCategoryId: key,
          }),
          roundDurationSeconds:
            r.eventWeightCategory.eventAgeGroup.rulesetAgeGroup
              .roundDurationSeconds ?? 120,
          regs: [],
        });
      }
      byCat.get(key)!.regs.push(r);
    }

    if (byCat.size === 0) {
      throw new Error('NO_ELIGIBLE_REGISTRATIONS');
    }

    const seed = input.seed ?? Date.now() % 2147483647;

    return this.prisma.$transaction(async (tx) => {
      if (existingBracketCount > 0) {
        await tx.timerState.deleteMany({
          where: {
            organisationId: input.organisationId,
            fight: { eventId: input.eventId },
          },
        });
        await tx.fight.deleteMany({
          where: { organisationId: input.organisationId, eventId: input.eventId },
        });
        await tx.bracket.deleteMany({
          where: { organisationId: input.organisationId, eventId: input.eventId },
        });
      }

      const brackets: Prisma.BracketGetPayload<{
        include: { fights: true };
      }>[] = [];

      for (const catGroup of byCat.values()) {
        const { regs, eventWeightCategoryId, roundDurationSeconds, categoryCode } =
          catGroup;
        const uniqueAthleteIds = [...new Set(regs.map((r) => r.athlete.id))];

        let athleteIds = seededShuffle(uniqueAthleteIds, seed);
        if (input.sameClubSeparation) {
          athleteIds = this.separateSameClub(
            athleteIds,
            regs.map((r) => ({ id: r.athlete.id, clubId: r.athlete.clubId })),
          );
        }

        const bracket = await tx.bracket.create({
          data: {
            organisationId: input.organisationId,
            eventId: input.eventId,
            categoryCode,
            seed,
          },
        });

        const competitionFormat = resolveCompetitionFormat({
          eligibleAthletesCount: athleteIds.length,
        });

        const bouts =
          competitionFormat === 'ROUND_ROBIN'
            ? buildRoundRobinBracket(athleteIds)
            : buildSingleElimBracket(athleteIds);
        for (const bout of bouts) {
          await tx.fight.create({
            data: {
              organisationId: input.organisationId,
              eventId: input.eventId,
              bracketId: bracket.id,
              categoryCode,
              eventWeightCategoryId,
              roundDurationSeconds,
              round: bout.round,
              boutNo: bout.boutNo,
              redAthleteId: bout.redId,
              blueAthleteId: bout.blueId,
              status: 'QUEUED',
            },
          });
        }

        if (competitionFormat !== 'ROUND_ROBIN') {
          await this.linkFightDependencies(tx, bracket.id);
          await this.autoConfirmByes(tx, bracket.id);
        }

        const fullBracket = await tx.bracket.findUnique({
          where: { id: bracket.id },
          include: { fights: true },
        });
        if (fullBracket) brackets.push(fullBracket);
      }

      await tx.event.update({
        where: { id: input.eventId },
        data: {
          lifecycle:
            event.publishTimingPolicyCode === 'IMMEDIATE_AFTER_DRAW'
              ? 'PUBLISHED'
              : 'DRAWN',
          published:
            event.publishTimingPolicyCode === 'IMMEDIATE_AFTER_DRAW'
              ? true
              : undefined,
        },
      });

      if (event.publishTimingPolicyCode === 'IMMEDIATE_AFTER_DRAW') {
        await this.audit.write(
          {
            organisationId: input.organisationId,
            eventId: input.eventId,
            actorUserId: input.actorUserId,
            action: 'BRACKETS_PUBLISHED',
            entityType: 'event',
            entityId: input.eventId,
            after: {
              policy: event.publishTimingPolicyCode,
              mode: 'AUTO_IMMEDIATE_AFTER_DRAW',
            } as unknown as Prisma.JsonValue,
            reason: input.reason ?? null,
            override: input.override ?? false,
          },
          tx,
        );
      }

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: input.eventId,
          actorUserId: input.actorUserId,
          action:
            existingBracketCount > 0 ? 'DRAW_REGENERATED' : 'DRAW_EXECUTED',
          entityType: 'event',
          entityId: input.eventId,
          before:
            existingBracketCount > 0
              ? ({
                  existingBracketCount,
                } as unknown as Prisma.JsonValue)
              : null,
          after: {
            seed,
            categories: Array.from(byCat.values()).map((group) => ({
              eventWeightCategoryId: group.eventWeightCategoryId,
              categoryCode: group.categoryCode,
              athleteCount: group.regs.length,
            })),
            totalAthletes: registrations.length,
            override: input.override ?? false,
          } as unknown as Prisma.JsonValue,
          reason: input.reason ?? null,
          override: input.override ?? false,
        },
        tx,
      );

      return { brackets, seed };
    });
  }

  async resetDraw(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    override: boolean;
    reason: string;
  }) {
    if (!input.override) throw new Error('OVERRIDE_REQUIRED');
    if (!input.reason?.trim()) throw new Error('REASON_REQUIRED');

    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const unsafeProgress = await this.hasUnsafeCompetitionProgress({
      organisationId: input.organisationId,
      eventId: input.eventId,
    });
    if (
      unsafeProgress ||
      event.published ||
      event.lifecycle === 'LIVE' ||
      event.lifecycle === 'COMPLETED'
    ) {
      throw new Error('DRAW_MUTATION_BLOCKED');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.timerState.deleteMany({
        where: {
          organisationId: input.organisationId,
          fight: { eventId: input.eventId },
        },
      });
      await tx.fight.deleteMany({
        where: { organisationId: input.organisationId, eventId: input.eventId },
      });
      await tx.bracket.deleteMany({
        where: { organisationId: input.organisationId, eventId: input.eventId },
      });

      await tx.event.update({
        where: { id: input.eventId },
        data: { lifecycle: 'WEIGH_IN_COMPLETED' },
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: input.eventId,
          actorUserId: input.actorUserId,
          action: 'DRAW_RESET',
          entityType: 'event',
          entityId: input.eventId,
          reason: input.reason,
          override: true,
        },
        tx,
      );
    });

    return { ok: true };
  }

  async listBrackets(organisationId: string, eventId: string) {
    return this.prisma.bracket.findMany({
      where: { organisationId, eventId },
      include: {
        fights: {
          include: {
            redAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
            blueAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
            winnerAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
        },
      },
      orderBy: { categoryCode: 'asc' },
    });
  }

  async getBracket(organisationId: string, bracketId: string) {
    return this.prisma.bracket.findFirst({
      where: { id: bracketId, organisationId },
      include: {
        fights: {
          include: {
            redAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
            blueAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
            winnerAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
        },
      },
    });
  }

  private async autoConfirmByes(
    tx: Prisma.TransactionClient,
    bracketId: string,
  ): Promise<void> {
    let moreToProcess = true;
    while (moreToProcess) {
      moreToProcess = false;
      const byeFights = await tx.fight.findMany({
        where: {
          bracketId,
          status: 'QUEUED',
          OR: [
            { redAthleteId: null, blueAthleteId: { not: null } },
            { blueAthleteId: null, redAthleteId: { not: null } },
          ],
        },
        orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
      });

      for (const byeFight of byeFights) {
        const missingSlot = byeFight.redAthleteId == null ? 'RED' : 'BLUE';

        // If the empty slot is fed by an upstream fight, this is not a real BYE.
        // It is an unresolved dependency ("Winner of X") and must stay unresolved.
        const hasDependencyForMissingSlot = await tx.fight.findFirst({
          where: {
            nextFightId: byeFight.id,
            nextFightSlot: missingSlot,
          },
          select: { id: true },
        });
        if (hasDependencyForMissingSlot) {
          continue;
        }

        const winnerId = (byeFight.redAthleteId ?? byeFight.blueAthleteId)!;
        const updatedByeFight = await tx.fight.update({
          where: { id: byeFight.id },
          data: {
            status: 'CONFIRMED',
            winnerAthleteId: winnerId,
            winMethod: 'WO',
          },
        });

        const nextFight = await this.propagateWinnerToNextFight(
          tx,
          updatedByeFight,
        );
        if (nextFight && nextFight.status === 'QUEUED') {
          moreToProcess = true;
        }
      }
    }
  }

  private async linkFightDependencies(
    tx: Prisma.TransactionClient,
    bracketId: string,
  ): Promise<void> {
    const fights = await tx.fight.findMany({
      where: { bracketId },
      select: { id: true, round: true, boutNo: true },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });
    const byRoundBout = new Map(
      fights.map((fight) => [`${fight.round}:${fight.boutNo}`, fight]),
    );

    for (const fight of fights) {
      const nextFight = byRoundBout.get(
        `${fight.round + 1}:${Math.ceil(fight.boutNo / 2)}`,
      );

      await tx.fight.update({
        where: { id: fight.id },
        data: {
          nextFightId: nextFight?.id ?? null,
          nextFightSlot:
            nextFight == null
              ? null
              : fight.boutNo % 2 === 1
                ? 'RED'
                : 'BLUE',
        },
      });
    }
  }

  private async propagateWinnerToNextFight(
    tx: Prisma.TransactionClient,
    fight: {
      winnerAthleteId: string | null;
      nextFightId: string | null;
      nextFightSlot: 'RED' | 'BLUE' | null;
    },
  ) {
    if (!fight.winnerAthleteId || !fight.nextFightId || !fight.nextFightSlot) {
      return null;
    }

    const nextFight = await tx.fight.findUnique({
      where: { id: fight.nextFightId },
    });
    if (!nextFight) return null;

    const isRedSlot = fight.nextFightSlot === 'RED';
    const targetField = isRedSlot ? 'redAthleteId' : 'blueAthleteId';
    const existingAthleteId = isRedSlot
      ? nextFight.redAthleteId
      : nextFight.blueAthleteId;
    if (existingAthleteId === fight.winnerAthleteId) {
      return nextFight;
    }

    return tx.fight.update({
      where: { id: nextFight.id },
      data: {
        [targetField]: fight.winnerAthleteId,
      },
    });
  }

  private separateSameClub(
    athleteIds: string[],
    athletes: Array<{ id: string; clubId: string | null }>,
  ): string[] {
    const clubMap = new Map(athletes.map((a) => [a.id, a.clubId]));
    const result: string[] = [];
    const remaining = [...athleteIds];

    while (remaining.length > 0) {
      const last = result[result.length - 1];
      const lastClub = last ? clubMap.get(last) : null;

      const nextIdx = remaining.findIndex((id) => clubMap.get(id) !== lastClub);
      if (nextIdx === -1) {
        result.push(...remaining.splice(0));
      } else {
        result.push(remaining.splice(nextIdx, 1)[0]);
      }
    }

    return result;
  }
}
