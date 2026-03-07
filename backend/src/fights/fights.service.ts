import { Injectable } from '@nestjs/common';
import type {
  FightStatus,
  Prisma,
  TimerStateEnum,
  WinMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

const FIGHT_STATE_TRANSITIONS: Record<FightStatus, FightStatus[]> = {
  QUEUED: ['ON_DECK'],
  ON_DECK: ['IN_PROGRESS', 'QUEUED'],
  IN_PROGRESS: ['PAUSED', 'COMPLETE'],
  PAUSED: ['IN_PROGRESS', 'COMPLETE'],
  COMPLETE: ['CONFIRMED'],
  CONFIRMED: [],
};

@Injectable()
export class FightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: {
    organisationId: string;
    eventId?: string;
    matId?: string;
    status?: FightStatus;
  }) {
    const where: Prisma.FightWhereInput = {
      organisationId: params.organisationId,
    };
    if (params.eventId) where.eventId = params.eventId;
    if (params.matId) where.matId = params.matId;
    if (params.status) where.status = params.status;

    return this.prisma.fight.findMany({
      where,
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        mat: true,
        timerState: true,
      },
      orderBy: [{ matId: 'asc' }, { orderInMat: 'asc' }],
    });
  }

  async getById(organisationId: string, fightId: string) {
    return this.prisma.fight.findFirst({
      where: { id: fightId, organisationId },
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        mat: true,
        timerState: true,
      },
    });
  }

  async setState(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    to: FightStatus;
    override?: boolean;
    reason?: string | null;
  }): Promise<{
    fight: Prisma.FightGetPayload<object>;
    advanced: Prisma.FightGetPayload<object> | null;
  }> {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    const allowed = FIGHT_STATE_TRANSITIONS[fight.status] ?? [];
    const isDirect = allowed.includes(input.to);

    if (!isDirect) {
      if (!input.override) throw new Error('INVALID_STATE_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const updateData: Prisma.FightUncheckedUpdateInput = { status: input.to };
    if (input.to === 'CONFIRMED') {
      updateData.confirmedByUserId = input.actorUserId;
      updateData.confirmedAt = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fight.update({
        where: { id: input.fightId },
        data: updateData,
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: fight.eventId,
        actorUserId: input.actorUserId,
        action: 'FIGHT_STATE_CHANGED',
        entityType: 'fight',
        entityId: input.fightId,
        before: fight as unknown as Prisma.JsonValue,
        after: updated as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: !isDirect,
      });

      let advanced: typeof updated | null = null;
      if (
        input.to === 'CONFIRMED' &&
        fight.bracketId &&
        fight.winnerAthleteId
      ) {
        const nextRound = fight.round + 1;
        const nextBoutNo = Math.ceil(fight.boutNo / 2);
        const isRedSlot = fight.boutNo % 2 === 1;

        const nextFight = await tx.fight.findFirst({
          where: {
            bracketId: fight.bracketId,
            round: nextRound,
            boutNo: nextBoutNo,
          },
        });
        if (nextFight) {
          advanced = await tx.fight.update({
            where: { id: nextFight.id },
            data: isRedSlot
              ? { redAthleteId: fight.winnerAthleteId }
              : { blueAthleteId: fight.winnerAthleteId },
          });
        }
      }

      return { fight: updated, advanced };
    });
  }

  async timerAction(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    action: 'START' | 'PAUSE' | 'RESUME' | 'RESET';
    round?: number;
    expectedUpdatedAt?: string | null;
  }) {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
      include: { timerState: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    const now = new Date();
    const existing = fight.timerState;

    if (input.expectedUpdatedAt) {
      if (!existing) throw new Error('TIMER_STALE_UPDATE');
      const expectedMs = new Date(input.expectedUpdatedAt).getTime();
      if (
        Number.isNaN(expectedMs) ||
        existing.updatedAt.getTime() !== expectedMs
      ) {
        throw new Error('TIMER_STALE_UPDATE');
      }
    }

    let newState: TimerStateEnum;
    let startedAt: Date | null = existing?.startedAt ?? null;
    let pausedAt: Date | null = null;
    let pausedMs: number = existing?.pausedMs ?? 0;

    switch (input.action) {
      case 'START':
        newState = 'RUNNING';
        startedAt = now;
        pausedMs = 0;
        break;
      case 'PAUSE':
        if (existing?.state !== 'RUNNING') throw new Error('TIMER_NOT_RUNNING');
        newState = 'PAUSED';
        pausedAt = now;
        pausedMs =
          existing.pausedMs +
          (now.getTime() - (existing.startedAt?.getTime() ?? now.getTime()));
        startedAt = existing.startedAt;
        break;
      case 'RESUME':
        if (existing?.state !== 'PAUSED') throw new Error('TIMER_NOT_PAUSED');
        newState = 'RUNNING';
        startedAt = now;
        pausedMs = existing.pausedMs;
        break;
      case 'RESET':
        newState = 'IDLE';
        startedAt = null;
        pausedMs = 0;
        break;
    }

    const timerData = {
      state: newState,
      round: input.round ?? existing?.round ?? 1,
      startedAt,
      pausedAt,
      pausedMs,
      updatedByUserId: input.actorUserId,
    };

    await this.prisma.timerState.upsert({
      where: { fightId: input.fightId },
      create: {
        fightId: input.fightId,
        organisationId: input.organisationId,
        ...timerData,
      },
      update: timerData,
    });

    return this.prisma.timerState.findUnique({
      where: { fightId: input.fightId },
    });
  }

  async setResult(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    winner: 'RED' | 'BLUE';
    method: WinMethod;
    notes?: string | null;
    override?: boolean;
    reason?: string | null;
  }) {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    if (fight.status === 'CONFIRMED' && !input.override) {
      throw new Error('FIGHT_ALREADY_CONFIRMED');
    }
    if (input.override && !input.reason)
      throw new Error('OVERRIDE_REASON_REQUIRED');

    const winnerAthleteId =
      input.winner === 'RED' ? fight.redAthleteId : fight.blueAthleteId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fight.update({
        where: { id: input.fightId },
        data: {
          winnerAthleteId,
          winMethod: input.method,
          notes: input.notes ?? null,
          status: 'COMPLETE',
        },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: fight.eventId,
        actorUserId: input.actorUserId,
        action: input.override ? 'FIGHT_RESULT_AMENDED' : 'FIGHT_RESULT_SET',
        entityType: 'fight',
        entityId: input.fightId,
        before: fight as unknown as Prisma.JsonValue,
        after: updated as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: input.override ?? false,
      });

      return updated;
    });
  }
}
