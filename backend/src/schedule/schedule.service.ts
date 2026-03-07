import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listMats(organisationId: string, eventId: string) {
    return this.prisma.mat.findMany({
      where: { organisationId, eventId },
      orderBy: { order: 'asc' },
    });
  }

  async upsertMat(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    id?: string;
    name: string;
    order: number;
  }) {
    if (input.id) {
      const existing = await this.prisma.mat.findFirst({
        where: {
          id: input.id,
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
      });
      if (!existing) throw new Error('MAT_NOT_FOUND');
      return this.prisma.mat.update({
        where: { id: input.id },
        data: { name: input.name, order: input.order },
      });
    }
    return this.prisma.mat.create({
      data: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        name: input.name,
        order: input.order,
      },
    });
  }

  async getSchedule(params: {
    organisationId: string;
    eventId: string;
    matId?: string;
  }) {
    const where: Prisma.FightWhereInput = {
      organisationId: params.organisationId,
      eventId: params.eventId,
    };
    if (params.matId) where.matId = params.matId;

    return this.prisma.fight.findMany({
      where,
      include: {
        mat: true,
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ matId: 'asc' }, { orderInMat: 'asc' }],
    });
  }

  async autoSchedule(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    startTimeIso: string;
    avgBoutSeconds: number;
    bufferSeconds: number;
    restMinutes: number;
    seed?: number;
    override?: boolean;
    reason?: string | null;
  }) {
    const fights = await this.prisma.fight.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });

    const mats = await this.prisma.mat.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      orderBy: { order: 'asc' },
    });

    if (mats.length === 0) throw new Error('NO_MATS');
    if (fights.length === 0) throw new Error('NO_FIGHTS');

    const baseTime = new Date(input.startTimeIso).getTime();
    if (isNaN(baseTime)) throw new Error('INVALID_START_TIME');

    const boutMs = (input.avgBoutSeconds + input.bufferSeconds) * 1000;
    const restMs = input.restMinutes * 60 * 1000;

    const matNextTime = new Map<string, number>();
    const athleteLastFightEndTime = new Map<string, number>();

    for (const mat of mats) {
      matNextTime.set(mat.id, baseTime);
    }

    const updates: Array<{
      id: string;
      matId: string;
      orderInMat: number;
      scheduledStartTime: Date;
    }> = [];
    const matOrderCounters = new Map<string, number>();
    for (const mat of mats) matOrderCounters.set(mat.id, 0);

    for (const fight of fights) {
      const athleteIds = [fight.redAthleteId, fight.blueAthleteId].filter(
        Boolean,
      ) as string[];

      let earliestStart = Infinity;
      let bestMatId = mats[0].id;

      for (const mat of mats) {
        const matReady = matNextTime.get(mat.id) ?? baseTime;

        const athleteReady = Math.max(
          ...athleteIds.map((id) => {
            const last = athleteLastFightEndTime.get(id) ?? 0;
            return last + restMs;
          }),
          matReady,
        );

        if (athleteReady < earliestStart) {
          earliestStart = athleteReady;
          bestMatId = mat.id;
        }
      }

      const orderInMat = (matOrderCounters.get(bestMatId) ?? 0) + 1;
      matOrderCounters.set(bestMatId, orderInMat);

      const fightEndTime = earliestStart + boutMs;
      matNextTime.set(bestMatId, fightEndTime);
      for (const id of athleteIds) {
        athleteLastFightEndTime.set(id, fightEndTime);
      }

      updates.push({
        id: fight.id,
        matId: bestMatId,
        orderInMat,
        scheduledStartTime: new Date(earliestStart),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const upd of updates) {
        await tx.fight.update({
          where: { id: upd.id },
          data: {
            matId: upd.matId,
            orderInMat: upd.orderInMat,
            scheduledStartTime: upd.scheduledStartTime,
          },
        });
      }

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        action: 'SCHEDULE_AUTO_GENERATED',
        entityType: 'event',
        entityId: input.eventId,
        after: {
          startTimeIso: input.startTimeIso,
          avgBoutSeconds: input.avgBoutSeconds,
          bufferSeconds: input.bufferSeconds,
          restMinutes: input.restMinutes,
          fightCount: fights.length,
          matCount: mats.length,
        } as unknown as Prisma.JsonValue,
        override: input.override ?? false,
        reason: input.reason ?? null,
      });
    });

    return updates;
  }

  async moveFight(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    toMatId: string;
    toOrder: number;
    override?: boolean;
    reason?: string | null;
  }) {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    if (input.override && !input.reason)
      throw new Error('OVERRIDE_REASON_REQUIRED');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fight.update({
        where: { id: input.fightId },
        data: { matId: input.toMatId, orderInMat: input.toOrder },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: fight.eventId,
        actorUserId: input.actorUserId,
        action: 'FIGHT_MOVED',
        entityType: 'fight',
        entityId: input.fightId,
        before: fight as unknown as Prisma.JsonValue,
        after: result as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: input.override ?? false,
      });

      return result;
    });

    return updated;
  }
}
