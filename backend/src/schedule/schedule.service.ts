import { Injectable } from '@nestjs/common';
import type { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { canManageSchedule, isEventReadOnly } from '../events/lifecycle-rules';
import {
  computeLiveStatuses,
  type LiveFightStatus,
} from '../fights/live-queue.logic';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertScheduleMutable(input: {
    event: Event;
    override?: boolean;
    reason?: string | null;
  }): void {
    if (isEventReadOnly(input.event.lifecycle) && !input.override) {
      throw new Error('EVENT_READ_ONLY');
    }

    if (!canManageSchedule(input.event.lifecycle) && !input.override) {
      throw new Error('EVENT_NOT_READY_FOR_SCHEDULE');
    }

    if (input.override && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }
  }

  private displayName(input: {
    athlete: { firstName: string; lastName: string } | null;
    sourceScheduleOrder: number | null;
  }): string {
    if (input.athlete) {
      return `${input.athlete.firstName} ${input.athlete.lastName}`;
    }
    if (input.sourceScheduleOrder != null) {
      return `Winner of ${input.sourceScheduleOrder}`;
    }
    return 'TBD';
  }

  private bracketRoundLabel(round: number, maxRound: number): string {
    const distanceToFinal = maxRound - round;
    if (distanceToFinal <= 0) return 'Final';
    if (distanceToFinal === 1) return 'Semifinal';
    if (distanceToFinal === 2) return 'Quarterfinal';
    if (distanceToFinal === 3) return 'Round of 16';
    return `Round ${round}`;
  }

  private isFightPlayable(fight: {
    redAthleteId: string | null;
    blueAthleteId: string | null;
    winnerAthleteId?: string | null;
    status:
      | 'QUEUED'
      | 'ON_DECK'
      | 'IN_PROGRESS'
      | 'PAUSED'
      | 'COMPLETE'
      | 'CONFIRMED';
  }): boolean {
    if (!fight.redAthleteId || !fight.blueAthleteId) return false;
    if (fight.redAthleteId === fight.blueAthleteId) return false;
    if (fight.winnerAthleteId) return false;
    return (
      fight.status === 'QUEUED' ||
      fight.status === 'ON_DECK' ||
      fight.status === 'IN_PROGRESS' ||
      fight.status === 'PAUSED'
    );
  }

  private isScheduleVisibleFight(input: {
    fight: {
      redAthleteId: string | null;
      blueAthleteId: string | null;
      round: number;
    };
    openingRound: number;
    hasSourceDependencies: boolean;
  }): boolean {
    const redKnown = !!input.fight.redAthleteId;
    const blueKnown = !!input.fight.blueAthleteId;

    // Hide only structural dead nodes (no athletes and no dependency source).
    if (!redKnown && !blueKnown && !input.hasSourceDependencies) return false;

    // Hide first-round BYE auto-paths from schedule numbering.
    if (input.fight.round === input.openingRound && redKnown !== blueKnown) {
      return false;
    }

    return true;
  }

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
    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId: params.organisationId,
        eventId: params.eventId,
      },
      include: {
        mat: true,
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [
        { eventWeightCategoryId: 'asc' },
        { categoryCode: 'asc' },
        { round: 'asc' },
        { boutNo: 'asc' },
      ],
    });

    const bucketByFightId = new Map<string, string>();
    const fightsByBucket = new Map<string, typeof fights>();
    for (const fight of fights) {
      const bucketKey =
        fight.bracketId ??
        fight.eventWeightCategoryId ??
        fight.categoryCode ??
        fight.id;
      const bucket = fightsByBucket.get(bucketKey) ?? [];
      bucket.push(fight);
      fightsByBucket.set(bucketKey, bucket);
      bucketByFightId.set(fight.id, bucketKey);
    }

    const fightSourceById = new Map<
      string,
      { redSourceFightId: string | null; blueSourceFightId: string | null }
    >();
    const roundLabelByFightId = new Map<string, string>();
    const visibleFights: typeof fights = [];

    for (const bucket of fightsByBucket.values()) {
      const openingRound =
        bucket.length > 0
          ? bucket.reduce((min, fight) => Math.min(min, fight.round), bucket[0].round)
          : 0;
      const maxRound =
        bucket.length > 0
          ? bucket.reduce((max, fight) => Math.max(max, fight.round), bucket[0].round)
          : 0;
      const byRoundBout = new Map(
        bucket.map((fight) => [`${fight.round}:${fight.boutNo}`, fight]),
      );

      for (const fight of bucket) {
        const redSourceFightId =
          fight.round > openingRound
            ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2 - 1}`)?.id ??
              null
            : null;
        const blueSourceFightId =
          fight.round > openingRound
            ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)?.id ?? null
            : null;
        const hasSourceDependencies = !!redSourceFightId || !!blueSourceFightId;

        fightSourceById.set(fight.id, { redSourceFightId, blueSourceFightId });
        roundLabelByFightId.set(
          fight.id,
          this.bracketRoundLabel(fight.round, maxRound),
        );

        if (
          this.isScheduleVisibleFight({
            fight,
            openingRound,
            hasSourceDependencies,
          })
        ) {
          visibleFights.push(fight);
        }
      }
    }

    const sortedVisible = [...visibleFights].sort((a, b) => {
      const bucketA = bucketByFightId.get(a.id) ?? '';
      const bucketB = bucketByFightId.get(b.id) ?? '';
      if (bucketA !== bucketB) return bucketA.localeCompare(bucketB);
      return a.round - b.round || a.boutNo - b.boutNo;
    });

    const scheduleOrderByFightId = new Map<string, number>();
    sortedVisible.forEach((fight, index) => {
      scheduleOrderByFightId.set(fight.id, index + 1);
    });

    const scheduleRows = sortedVisible.map((fight) => {
      const source = fightSourceById.get(fight.id) ?? {
        redSourceFightId: null,
        blueSourceFightId: null,
      };
      const redSourceScheduleOrder = source.redSourceFightId
        ? scheduleOrderByFightId.get(source.redSourceFightId) ?? null
        : null;
      const blueSourceScheduleOrder = source.blueSourceFightId
        ? scheduleOrderByFightId.get(source.blueSourceFightId) ?? null
        : null;

      return {
        id: fight.id,
        bracketRoundLabel:
          roundLabelByFightId.get(fight.id) ?? `Round ${fight.round}`,
        bracketFightNumber: fight.boutNo,
        scheduleOrder: scheduleOrderByFightId.get(fight.id) ?? null,
        redDisplayName: this.displayName({
          athlete: fight.redAthlete
            ? { firstName: fight.redAthlete.firstName, lastName: fight.redAthlete.lastName }
            : null,
          sourceScheduleOrder: redSourceScheduleOrder,
        }),
        blueDisplayName: this.displayName({
          athlete: fight.blueAthlete
            ? { firstName: fight.blueAthlete.firstName, lastName: fight.blueAthlete.lastName }
            : null,
          sourceScheduleOrder: blueSourceScheduleOrder,
        }),
        redSourceScheduleOrder,
        blueSourceScheduleOrder,
        isPlayable: this.isFightPlayable({
          redAthleteId: fight.redAthleteId,
          blueAthleteId: fight.blueAthleteId,
          winnerAthleteId: fight.winnerAthleteId,
          status: fight.status,
        }),
        isScheduled: fight.matId != null && fight.orderInMat != null,
        status: fight.status,
        matId: fight.matId,
        matName: fight.mat?.name ?? null,
        orderInMat: fight.orderInMat,
        scheduledAt: fight.scheduledStartTime,
        liveStatus: 'PENDING' as LiveFightStatus,
      };
    });

    const liveStatuses = computeLiveStatuses(
      scheduleRows.map((row) => ({
        id: row.id,
        matId: row.matId,
        orderInMat: row.orderInMat,
        scheduleOrder: row.scheduleOrder,
        status: row.status,
        isPlayable: row.isPlayable,
        isFinished: row.status === 'COMPLETE' || row.status === 'CONFIRMED',
      })),
    );
    for (const row of scheduleRows) {
      row.liveStatus = liveStatuses.get(row.id) ?? 'PENDING';
    }

    if (params.matId) {
      return scheduleRows.filter((row) => row.matId === params.matId);
    }

    return scheduleRows;
  }

  async autoSchedule(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    startTimeIso: string;
    avgBoutSeconds: number;
    bufferSeconds: number;
    restMinutes?: number;
    seed?: number;
    override?: boolean;
    reason?: string | null;
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({
      event,
      override: input.override,
      reason: input.reason ?? null,
    });

    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
      },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });
    const mats = await this.prisma.mat.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      orderBy: { order: 'asc' },
    });

    if (mats.length === 0) throw new Error('NO_MATS');
    const schedulableFights = fights.filter((fight) =>
      this.isFightPlayable({
        redAthleteId: fight.redAthleteId,
        blueAthleteId: fight.blueAthleteId,
        winnerAthleteId: fight.winnerAthleteId,
        status: fight.status,
      }),
    );
    if (schedulableFights.length === 0) {
      throw new Error('NO_SCHEDULABLE_FIGHTS');
    }

    const baseTime = new Date(input.startTimeIso).getTime();
    if (Number.isNaN(baseTime)) throw new Error('INVALID_START_TIME');

    const requestedRestMinutes = input.restMinutes ?? event.minRestMinutes;
    if (requestedRestMinutes < event.minRestMinutes && !input.override) {
      throw new Error('REST_CONSTRAINT_VIOLATION');
    }
    const appliedRestMinutes = input.override
      ? requestedRestMinutes
      : Math.max(event.minRestMinutes, requestedRestMinutes);

    const boutMs = (input.avgBoutSeconds + input.bufferSeconds) * 1000;
    const restMs = appliedRestMinutes * 60 * 1000;

    const matNextTime = new Map<string, number>();
    const athleteLastFightEndTime = new Map<string, number>();
    for (const mat of mats) matNextTime.set(mat.id, baseTime);

    const updates: Array<{
      id: string;
      matId: string;
      orderInMat: number;
      scheduledStartTime: Date;
    }> = [];
    const matOrderCounters = new Map<string, number>();
    for (const mat of mats) matOrderCounters.set(mat.id, 0);

    for (const fight of schedulableFights) {
      const athleteIds = [fight.redAthleteId, fight.blueAthleteId].filter(
        Boolean,
      ) as string[];

      let earliestStart = Infinity;
      let bestMatId = mats[0].id;

      for (const mat of mats) {
        const matReady = matNextTime.get(mat.id) ?? baseTime;
        const athleteReady = Math.max(
          ...athleteIds.map((id) => (athleteLastFightEndTime.get(id) ?? 0) + restMs),
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
      for (const id of athleteIds) athleteLastFightEndTime.set(id, fightEndTime);

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

      await this.audit.write(
        {
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
            requestedRestMinutes,
            appliedRestMinutes,
            policyMinRestMinutes: event.minRestMinutes,
            fightCount: schedulableFights.length,
            matCount: mats.length,
          } as unknown as Prisma.JsonValue,
          override: input.override ?? false,
          reason: input.reason ?? null,
        },
        tx,
      );
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
      include: { event: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');
    if (
      !this.isFightPlayable({
        redAthleteId: fight.redAthleteId,
        blueAthleteId: fight.blueAthleteId,
        winnerAthleteId: fight.winnerAthleteId,
        status: fight.status,
      })
    ) {
      throw new Error('FIGHT_NOT_SCHEDULABLE');
    }

    this.assertScheduleMutable({
      event: fight.event,
      override: input.override,
      reason: input.reason ?? null,
    });

    const targetMat = await this.prisma.mat.findFirst({
      where: {
        id: input.toMatId,
        organisationId: input.organisationId,
        eventId: fight.eventId,
      },
    });
    if (!targetMat) throw new Error('MAT_NOT_FOUND');

    const restViolation = await this.hasImmediateRestViolation({
      organisationId: input.organisationId,
      eventId: fight.eventId,
      fightId: fight.id,
      toMatId: input.toMatId,
      toOrder: input.toOrder,
      minRestMinutes: fight.event.minRestMinutes,
    });
    if (restViolation && !input.override) {
      throw new Error('REST_CONSTRAINT_VIOLATION');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const targetFights = await tx.fight.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          matId: input.toMatId,
          id: { not: fight.id },
        },
        orderBy: { orderInMat: 'asc' },
      });

      const sourceFights =
        fight.matId && fight.matId !== input.toMatId
          ? await tx.fight.findMany({
              where: {
                organisationId: input.organisationId,
                eventId: fight.eventId,
                matId: fight.matId,
                id: { not: fight.id },
              },
              orderBy: { orderInMat: 'asc' },
            })
          : [];

      const insertAt = Math.max(0, Math.min(targetFights.length, input.toOrder - 1));
      const targetIds = targetFights.map((item) => item.id);
      targetIds.splice(insertAt, 0, fight.id);

      for (let i = 0; i < targetIds.length; i++) {
        await tx.fight.update({
          where: { id: targetIds[i] },
          data: {
            matId: input.toMatId,
            orderInMat: i + 1,
          },
        });
      }

      if (sourceFights.length > 0) {
        for (let i = 0; i < sourceFights.length; i++) {
          await tx.fight.update({
            where: { id: sourceFights[i].id },
            data: { orderInMat: i + 1 },
          });
        }
      }

      const result = await tx.fight.findUnique({
        where: { id: input.fightId },
      });
      if (!result) throw new Error('FIGHT_NOT_FOUND');

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          actorUserId: input.actorUserId,
          action: 'FIGHT_MOVED',
          entityType: 'fight',
          entityId: input.fightId,
          before: {
            matId: fight.matId,
            orderInMat: fight.orderInMat,
          } as unknown as Prisma.JsonValue,
          after: {
            matId: result.matId,
            orderInMat: result.orderInMat,
          } as unknown as Prisma.JsonValue,
          reason: input.reason ?? null,
          override: input.override ?? false,
        },
        tx,
      );

      return result;
    });

    return updated;
  }

  private async hasImmediateRestViolation(input: {
    organisationId: string;
    eventId: string;
    fightId: string;
    toMatId: string;
    toOrder: number;
    minRestMinutes: number;
  }): Promise<boolean> {
    const moving = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
      select: {
        redAthleteId: true,
        blueAthleteId: true,
        scheduledStartTime: true,
      },
    });
    if (!moving) return false;

    const movingAthletes = [moving.redAthleteId, moving.blueAthleteId].filter(
      Boolean,
    ) as string[];
    if (movingAthletes.length === 0) return false;

    const neighbours = await this.prisma.fight.findMany({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        matId: input.toMatId,
        id: { not: input.fightId },
        orderInMat: {
          in: [Math.max(1, input.toOrder - 1), input.toOrder],
        },
      },
      select: {
        redAthleteId: true,
        blueAthleteId: true,
        scheduledStartTime: true,
      },
    });

    for (const neighbour of neighbours) {
      const neighbourAthletes = [neighbour.redAthleteId, neighbour.blueAthleteId].filter(
        Boolean,
      ) as string[];
      if (neighbourAthletes.some((id) => movingAthletes.includes(id))) {
        if (!neighbour.scheduledStartTime || !moving.scheduledStartTime) return true;
        const diffMinutes =
          Math.abs(
            neighbour.scheduledStartTime.getTime() -
              moving.scheduledStartTime.getTime(),
          ) /
          (60 * 1000);
        if (diffMinutes < input.minRestMinutes) return true;
      }
    }

    return false;
  }
}
