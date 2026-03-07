import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { seededShuffle, buildSingleElimBracket } from './draw.utils';

@Injectable()
export class DrawService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

    if (event.lifecycle !== 'LOCKED' && !input.override) {
      throw new Error('EVENT_NOT_LOCKED');
    }
    if (input.override && !input.reason)
      throw new Error('OVERRIDE_REASON_REQUIRED');

    const registrations = await this.prisma.registration.findMany({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        status: 'APPROVED',
      },
      include: {
        athlete: { select: { id: true, clubId: true } },
        eventWeightCategory: {
          include: {
            rulesetWeightCategory: { select: { name: true } },
            eventAgeGroup: {
              include: {
                rulesetAgeGroup: { select: { roundDurationSeconds: true } },
              },
            },
          },
        },
      },
    });

    // Group by eventWeightCategoryId first, fall back to categoryCode for legacy rows
    type RegRow = (typeof registrations)[0];
    const byCat = new Map<
      string,
      {
        key: string;
        eventWeightCategoryId: string | null;
        roundDurationSeconds: number;
        regs: RegRow[];
      }
    >();
    for (const r of registrations) {
      const key = r.eventWeightCategoryId ?? r.categoryCode;
      if (!byCat.has(key)) {
        const roundDuration =
          r.eventWeightCategory?.eventAgeGroup?.rulesetAgeGroup
            ?.roundDurationSeconds ?? 120;
        byCat.set(key, {
          key,
          eventWeightCategoryId: r.eventWeightCategoryId,
          roundDurationSeconds: roundDuration,
          regs: [],
        });
      }
      byCat.get(key)!.regs.push(r);
    }

    const seed = input.seed ?? Date.now() % 2147483647;

    return this.prisma.$transaction(async (tx) => {
      const brackets: Prisma.BracketGetPayload<{
        include: { fights: true };
      }>[] = [];

      for (const catGroup of byCat.values()) {
        const { regs, eventWeightCategoryId, roundDurationSeconds } = catGroup;
        const categoryCode =
          regs[0].eventWeightCategory?.rulesetWeightCategory?.name ??
          regs[0].categoryCode;

        let athleteIds = regs.map((r) => r.athlete.id);
        athleteIds = seededShuffle(athleteIds, seed);

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

        const bouts = buildSingleElimBracket(athleteIds);

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

        await this.autoConfirmByes(tx, bracket.id);

        const fullBracket = await tx.bracket.findUnique({
          where: { id: bracket.id },
          include: { fights: true },
        });
        if (fullBracket) brackets.push(fullBracket);
      }

      await tx.event.update({
        where: { id: input.eventId },
        data: { lifecycle: 'DRAWN' },
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: input.eventId,
          actorUserId: input.actorUserId,
          action: 'DRAW_EXECUTED',
          entityType: 'event',
          entityId: input.eventId,
          after: {
            seed,
            categories: Array.from(byCat.values()).map((g) => g.key),
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
        data: { lifecycle: 'LOCKED' },
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
    // Process one round at a time to avoid confirming future-round placeholders (null vs null).
    // Only auto-confirm fights where EXACTLY ONE side is a real athlete and the other is null (bye).
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
        const winnerId = (byeFight.redAthleteId ?? byeFight.blueAthleteId)!;
        await tx.fight.update({
          where: { id: byeFight.id },
          data: {
            status: 'CONFIRMED',
            winnerAthleteId: winnerId,
            winMethod: 'WO',
          },
        });

        const nextBoutNo = Math.ceil(byeFight.boutNo / 2);
        const isRedSlot = byeFight.boutNo % 2 === 1;
        const nextFight = await tx.fight.findFirst({
          where: { bracketId, round: byeFight.round + 1, boutNo: nextBoutNo },
        });
        if (nextFight && nextFight.status === 'QUEUED') {
          await tx.fight.update({
            where: { id: nextFight.id },
            data: isRedSlot
              ? { redAthleteId: winnerId }
              : { blueAthleteId: winnerId },
          });
          moreToProcess = true;
        }
      }
    }
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
