import { Injectable } from '@nestjs/common';
import type {
  EventLifecycle,
  FightStatus,
  Prisma,
  TimerStateEnum,
  WinMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { canRunLiveCompetition } from '../events/lifecycle-rules';
import {
  buildBracketOrCompetitionViewModel,
  type CompetitionAthlete,
  type CompetitionFight,
} from '../competition/competition.logic';
import { resolveCompetitionFormat } from '../draw/competition-format';
import { roundStageLabel } from '../draw/brackets.helpers';
import {
  computeLiveStatuses,
  type LiveFightStatus,
} from './live-queue.logic';
import {
  hasRecordedResult,
  isDownstreamFightLocked,
} from './result-safeguards';

const FIGHT_STATE_TRANSITIONS: Record<FightStatus, FightStatus[]> = {
  QUEUED: ['ON_DECK'],
  ON_DECK: ['IN_PROGRESS', 'QUEUED'],
  IN_PROGRESS: ['PAUSED'],
  PAUSED: ['IN_PROGRESS'],
  COMPLETE: ['CONFIRMED'],
  CONFIRMED: [],
};

@Injectable()
export class FightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertLiveStage(
    lifecycle: EventLifecycle,
    override?: boolean,
    reason?: string | null,
  ): void {
    if (canRunLiveCompetition(lifecycle)) return;
    if (!override) throw new Error('EVENT_NOT_LIVE');
    if (!reason) throw new Error('OVERRIDE_REASON_REQUIRED');
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

    if (!redKnown && !blueKnown && !input.hasSourceDependencies) return false;
    if (input.fight.round === input.openingRound && redKnown !== blueKnown) {
      return false;
    }
    return true;
  }

  private computeCompletionState(input: {
    totalVisibleFights: number;
    completedVisibleFights: number;
    hasActiveFight: boolean;
    needsReview: boolean;
  }): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW' {
    if (input.needsReview) return 'NEEDS_REVIEW';
    if (input.totalVisibleFights === 0) return 'NOT_STARTED';
    if (input.completedVisibleFights >= input.totalVisibleFights) return 'COMPLETED';
    if (input.completedVisibleFights > 0 || input.hasActiveFight) return 'IN_PROGRESS';
    return 'NOT_STARTED';
  }

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

  async getLiveCategoryBoard(input: {
    organisationId: string;
    eventId: string;
    eventWeightCategoryId?: string;
    matId?: string;
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
      select: { id: true },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        eventWeightCategoryId: { not: null },
      },
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        timerState: true,
        mat: { select: { id: true, name: true } },
        eventWeightCategory: {
          select: {
            id: true,
            rulesetWeightCategory: { select: { name: true } },
            eventAgeGroup: {
              select: {
                rulesetAgeGroup: {
                  select: { name: true },
                },
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
    });

    const fightsByCategory = new Map<string, typeof fights>();
    for (const fight of fights) {
      if (!fight.eventWeightCategoryId) continue;
      const bucket = fightsByCategory.get(fight.eventWeightCategoryId) ?? [];
      bucket.push(fight);
      fightsByCategory.set(fight.eventWeightCategoryId, bucket);
    }

    const categories = [...fightsByCategory.entries()].map(
      ([eventWeightCategoryId, categoryFights]) => {
        const athleteById = new Map<string, string>();
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

        const athletes: CompetitionAthlete[] = [...athleteById.entries()].map(
          ([athleteId, athleteName]) => ({
            athleteId,
            athleteName,
          }),
        );
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

        const competitionFormat = resolveCompetitionFormat({
          athleteCount: athleteById.size,
        });
        const integrityView = buildBracketOrCompetitionViewModel({
          format: competitionFormat,
          fights: competitionFights,
          athletes,
        });
        const openingRound =
          categoryFights.length > 0
            ? categoryFights.reduce(
                (min, fight) => Math.min(min, fight.round),
                categoryFights[0].round,
              )
            : 0;
        const maxRound =
          categoryFights.length > 0
            ? categoryFights.reduce(
                (max, fight) => Math.max(max, fight.round),
                categoryFights[0].round,
              )
            : 0;
        const byRoundBout = new Map(
          categoryFights.map((fight) => [`${fight.round}:${fight.boutNo}`, fight]),
        );

        const sourceByFightId = new Map<
          string,
          { redSourceFightId: string | null; blueSourceFightId: string | null }
        >();
        const visibleFights = categoryFights.filter((fight) => {
          const redSourceFightId =
            fight.round > openingRound
              ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2 - 1}`)?.id ??
                null
              : null;
          const blueSourceFightId =
            fight.round > openingRound
              ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)?.id ??
                null
              : null;
          sourceByFightId.set(fight.id, { redSourceFightId, blueSourceFightId });
          return this.isScheduleVisibleFight({
            fight,
            openingRound,
            hasSourceDependencies: !!redSourceFightId || !!blueSourceFightId,
          });
        });

        const orderedVisible = [...visibleFights].sort(
          (a, b) => a.round - b.round || a.boutNo - b.boutNo,
        );
        const scheduleOrderByFightId = new Map<string, number>();
        orderedVisible.forEach((fight, index) => {
          scheduleOrderByFightId.set(fight.id, index + 1);
        });

        const rows = orderedVisible.map((fight) => {
          const source = sourceByFightId.get(fight.id) ?? {
            redSourceFightId: null,
            blueSourceFightId: null,
          };
          const redSourceScheduleOrder = source.redSourceFightId
            ? scheduleOrderByFightId.get(source.redSourceFightId) ?? null
            : null;
          const blueSourceScheduleOrder = source.blueSourceFightId
            ? scheduleOrderByFightId.get(source.blueSourceFightId) ?? null
            : null;
          const redDisplayName = fight.redAthlete
            ? `${fight.redAthlete.firstName} ${fight.redAthlete.lastName}`
            : redSourceScheduleOrder != null
              ? `Winner of ${redSourceScheduleOrder}`
              : 'TBD';
          const blueDisplayName = fight.blueAthlete
            ? `${fight.blueAthlete.firstName} ${fight.blueAthlete.lastName}`
            : blueSourceScheduleOrder != null
              ? `Winner of ${blueSourceScheduleOrder}`
              : 'TBD';
          const timerState = fight.timerState
            ? {
                state: fight.timerState.state,
                startedAt: fight.timerState.startedAt,
                pausedAt: fight.timerState.pausedAt,
                elapsed: fight.timerState.pausedMs,
                updatedAt: fight.timerState.updatedAt,
              }
            : null;
          const isPlayable = this.isFightPlayable({
            redAthleteId: fight.redAthleteId,
            blueAthleteId: fight.blueAthleteId,
            winnerAthleteId: fight.winnerAthleteId,
            status: fight.status,
          });
          const isCompleted =
            fight.status === 'COMPLETE' ||
            fight.status === 'CONFIRMED' ||
            !!fight.winnerAthleteId;

          return {
            id: fight.id,
            round: fight.round,
            boutNo: fight.boutNo,
            stageLabel: roundStageLabel(fight.round, maxRound, competitionFormat),
            bracketRoundLabel:
              fight.round === maxRound
                ? 'Final'
                : fight.round === maxRound - 1
                  ? 'Semifinal'
                  : fight.round === maxRound - 2
                    ? 'Quarterfinal'
                    : `Round ${fight.round}`,
            status: fight.status,
            winMethod: fight.winMethod ?? null,
            notes: fight.notes ?? null,
            winnerAthleteId: fight.winnerAthleteId ?? null,
            scheduleOrder: scheduleOrderByFightId.get(fight.id) ?? null,
            redSourceScheduleOrder,
            blueSourceScheduleOrder,
            red: {
              athleteId: fight.redAthleteId ?? null,
              name: redDisplayName,
              kind: fight.redAthleteId
                ? ('ATHLETE' as const)
                : redSourceScheduleOrder != null
                  ? ('WINNER_PLACEHOLDER' as const)
                  : ('TBD' as const),
              sourceBoutNo: source.redSourceFightId
                ? byRoundBout.get(
                    `${fight.round - 1}:${fight.boutNo * 2 - 1}`,
                  )?.boutNo ?? null
                : null,
            },
            blue: {
              athleteId: fight.blueAthleteId ?? null,
              name: blueDisplayName,
              kind: fight.blueAthleteId
                ? ('ATHLETE' as const)
                : blueSourceScheduleOrder != null
                  ? ('WINNER_PLACEHOLDER' as const)
                  : ('TBD' as const),
              sourceBoutNo: source.blueSourceFightId
                ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)?.boutNo ??
                  null
                : null,
            },
            timerState,
            isPlayable,
            isCompleted,
            liveStatus: 'PENDING' as LiveFightStatus,
            matId: fight.matId ?? null,
            matName: fight.mat?.name ?? null,
            orderInMat: fight.orderInMat ?? null,
            scheduledAt: fight.scheduledStartTime ?? null,
          };
        });

        const liveStatuses = computeLiveStatuses(
          rows.map((row) => ({
            id: row.id,
            matId: row.matId,
            orderInMat: row.orderInMat,
            scheduleOrder: row.scheduleOrder,
            status: row.status,
            isPlayable: row.isPlayable,
            isFinished: row.isCompleted,
          })),
        );
        for (const row of rows) {
          row.liveStatus = liveStatuses.get(row.id) ?? 'PENDING';
        }

        const matScopedRows = input.matId
          ? rows.filter((row) => row.matId === input.matId)
          : rows;
        const sortedBySchedule = [...matScopedRows].sort(
          (a, b) =>
            (a.scheduleOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.scheduleOrder ?? Number.MAX_SAFE_INTEGER),
        );

        const currentFight =
          sortedBySchedule.find((row) => row.liveStatus === 'RUNNING') ??
          sortedBySchedule.find((row) => row.liveStatus === 'UPCOMING') ??
          null;

        const onDeck =
          currentFight == null
            ? null
            : sortedBySchedule.find(
                (row) =>
                  row.id !== currentFight.id &&
                  row.liveStatus === 'UPCOMING' &&
                  (row.scheduleOrder ?? Number.MAX_SAFE_INTEGER) >
                    (currentFight.scheduleOrder ?? Number.MAX_SAFE_INTEGER),
              ) ?? null;

        const queue = sortedBySchedule.filter((row) => {
          if (currentFight && row.id === currentFight.id) return false;
          if (onDeck && row.id === onDeck.id) return false;
          if (row.liveStatus === 'FINISHED') return false;
          if (!currentFight) return true;
          return (
            (row.scheduleOrder ?? Number.MAX_SAFE_INTEGER) >
            (currentFight.scheduleOrder ?? Number.MAX_SAFE_INTEGER)
          );
        });

        const completed = sortedBySchedule.filter((row) => row.isCompleted);
        const totalVisibleFights = rows.length;
        const completedVisibleFights = rows.filter((row) => row.isCompleted).length;
        const hasActiveFight = rows.some(
          (row) => row.status === 'IN_PROGRESS' || row.status === 'PAUSED',
        );

        return {
          eventWeightCategoryId,
          categoryCode: categoryFights[0]?.categoryCode ?? eventWeightCategoryId,
          categoryName:
            categoryFights[0]?.eventWeightCategory?.rulesetWeightCategory?.name ??
            categoryFights[0]?.categoryCode ??
            eventWeightCategoryId,
          ageGroupName:
            categoryFights[0]?.eventWeightCategory?.eventAgeGroup?.rulesetAgeGroup
              ?.name ?? null,
          competitionFormat,
          athleteCount: athleteById.size,
          totalFights: totalVisibleFights,
          completedFights: completedVisibleFights,
          completionState: this.computeCompletionState({
            totalVisibleFights,
            completedVisibleFights,
            hasActiveFight,
            needsReview: integrityView.needsReview,
          }),
          currentFightStatus: currentFight?.status ?? null,
          needsReview: integrityView.needsReview,
          issues: integrityView.issues,
          board: {
            currentFight,
            onDeck,
            queue,
            completed,
          },
        };
      },
    );

    const selectedCategoryId =
      (input.eventWeightCategoryId &&
      categories.some(
        (category) => category.eventWeightCategoryId === input.eventWeightCategoryId,
      )
        ? input.eventWeightCategoryId
        : null) ??
      categories.find((category) => category.board.currentFight)?.eventWeightCategoryId ??
      categories[0]?.eventWeightCategoryId ??
      null;

    const selectedCategory =
      categories.find(
        (category) => category.eventWeightCategoryId === selectedCategoryId,
      ) ?? null;

    return {
      eventId: input.eventId,
      categories: categories.map((category) => ({
        eventWeightCategoryId: category.eventWeightCategoryId,
        categoryCode: category.categoryCode,
        categoryName: category.categoryName,
        ageGroupName: category.ageGroupName,
        competitionFormat: category.competitionFormat,
        athleteCount: category.athleteCount,
        totalFights: category.totalFights,
        completedFights: category.completedFights,
        completionState: category.completionState,
        currentFightStatus: category.currentFightStatus,
        needsReview: category.needsReview,
        issues: category.issues,
      })),
      selectedCategoryId,
      board: selectedCategory
        ? {
            eventWeightCategoryId: selectedCategory.eventWeightCategoryId,
            categoryCode: selectedCategory.categoryCode,
            categoryName: selectedCategory.categoryName,
            ageGroupName: selectedCategory.ageGroupName,
            competitionFormat: selectedCategory.competitionFormat,
            athleteCount: selectedCategory.athleteCount,
            totalFights: selectedCategory.totalFights,
            completedFights: selectedCategory.completedFights,
            completionState: selectedCategory.completionState,
            needsReview: selectedCategory.needsReview,
            issues: selectedCategory.issues,
            currentFight: selectedCategory.board.currentFight,
            onDeck: selectedCategory.board.onDeck,
            queue: selectedCategory.board.queue,
            completed: selectedCategory.board.completed,
          }
        : null,
    };
  }

  async startFight(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
  }) {
    const existing = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
      select: { status: true },
    });
    if (!existing) throw new Error('FIGHT_NOT_FOUND');

    if (existing.status === 'QUEUED') {
      await this.setState({
        organisationId: input.organisationId,
        fightId: input.fightId,
        actorUserId: input.actorUserId,
        to: 'ON_DECK',
        override: false,
        reason: null,
      });
    }

    const { fight } = await this.setState({
      organisationId: input.organisationId,
      fightId: input.fightId,
      actorUserId: input.actorUserId,
      to: 'IN_PROGRESS',
      override: false,
      reason: null,
    });
    return fight;
  }

  async finishFight(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    winner: 'RED' | 'BLUE';
    method: WinMethod;
    notes?: string | null;
    override?: boolean;
    reason?: string | null;
  }) {
    const { fight, advanced } = await this.setResult({
      organisationId: input.organisationId,
      fightId: input.fightId,
      actorUserId: input.actorUserId,
      winner: input.winner,
      method: input.method,
      notes: input.notes ?? null,
      override: input.override ?? false,
      reason: input.reason ?? null,
    });
    return { fight, advanced };
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
      include: { event: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    this.assertLiveStage(fight.event.lifecycle, input.override, input.reason);

    const allowed = FIGHT_STATE_TRANSITIONS[fight.status] ?? [];
    const isDirect = allowed.includes(input.to);

    if (!isDirect) {
      if (!input.override) throw new Error('INVALID_STATE_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    if (input.to === 'IN_PROGRESS' && fight.matId) {
      const inProgressOnMat = await this.prisma.fight.findFirst({
        where: {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          matId: fight.matId,
          status: 'IN_PROGRESS',
          id: { not: fight.id },
        },
      });
      if (inProgressOnMat && !input.override) {
        throw new Error('MAT_ALREADY_IN_PROGRESS');
      }
      if (inProgressOnMat && !input.reason) {
        throw new Error('OVERRIDE_REASON_REQUIRED');
      }
    }

    if (input.to === 'COMPLETE' && !fight.winnerAthleteId) {
      throw new Error('WINNER_REQUIRED_FOR_COMPLETE');
    }

    const updateData: Prisma.FightUncheckedUpdateInput = { status: input.to };
    if (input.to === 'CONFIRMED') {
      updateData.confirmedByUserId = input.actorUserId;
      updateData.confirmedAt = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.fight.updateMany({
        where: {
          id: input.fightId,
          status: fight.status,
        },
        data: updateData,
      });
      if (updateResult.count === 0) {
        throw new Error('INVALID_STATE_TRANSITION');
      }

      const updated = await tx.fight.findUnique({
        where: { id: input.fightId },
      });
      if (!updated) {
        throw new Error('FIGHT_NOT_FOUND');
      }

      if (input.to === 'IN_PROGRESS') {
        const now = new Date();
        const timer = await tx.timerState.findUnique({
          where: { fightId: input.fightId },
        });

        if (!timer) {
          await tx.timerState.create({
            data: {
              fightId: input.fightId,
              organisationId: input.organisationId,
              state: 'RUNNING',
              round: 1,
              startedAt: now,
              pausedAt: null,
              pausedMs: 0,
              updatedByUserId: input.actorUserId,
            },
          });
        } else if (timer.state === 'PAUSED') {
          await tx.timerState.update({
            where: { fightId: input.fightId },
            data: {
              state: 'RUNNING',
              startedAt: now,
              pausedAt: null,
              updatedByUserId: input.actorUserId,
            },
          });
        } else if (timer.state === 'IDLE' || timer.state === 'FINISHED') {
          await tx.timerState.update({
            where: { fightId: input.fightId },
            data: {
              state: 'RUNNING',
              round: timer.round || 1,
              startedAt: now,
              pausedAt: null,
              pausedMs: 0,
              updatedByUserId: input.actorUserId,
            },
          });
        }
      }

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          actorUserId: input.actorUserId,
          action: 'FIGHT_STATE_CHANGED',
          entityType: 'fight',
          entityId: input.fightId,
          before: fight as unknown as Prisma.JsonValue,
          after: updated as unknown as Prisma.JsonValue,
          reason: input.reason ?? null,
          override:
            !isDirect ||
            !canRunLiveCompetition(fight.event.lifecycle) ||
            (input.override ?? false),
        },
        tx,
      );

      let advanced: typeof updated | null = null;
      if (input.to === 'CONFIRMED' && updated.winnerAthleteId) {
        advanced = await this.propagateWinnerToNextFight(tx, updated);
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
      include: { timerState: true, event: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');
    if (!canRunLiveCompetition(fight.event.lifecycle)) {
      throw new Error('EVENT_NOT_LIVE');
    }

    if (input.action === 'START' && fight.status !== 'IN_PROGRESS') {
      throw new Error('INVALID_FIGHT_STATE_FOR_TIMER');
    }
    if (input.action === 'PAUSE' && fight.status !== 'IN_PROGRESS') {
      throw new Error('INVALID_FIGHT_STATE_FOR_TIMER');
    }
    if (
      input.action === 'RESUME' &&
      !['IN_PROGRESS', 'PAUSED'].includes(fight.status)
    ) {
      throw new Error('INVALID_FIGHT_STATE_FOR_TIMER');
    }

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
    let pausedMs = existing?.pausedMs ?? 0;

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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timerState.upsert({
        where: { fightId: input.fightId },
        create: {
          fightId: input.fightId,
          organisationId: input.organisationId,
          ...timerData,
        },
        update: timerData,
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          actorUserId: input.actorUserId,
          action: 'FIGHT_TIMER_ACTION',
          entityType: 'fight',
          entityId: fight.id,
          before: existing as unknown as Prisma.JsonValue,
          after: updated as unknown as Prisma.JsonValue,
          reason: input.action,
        },
        tx,
      );

      return updated;
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
      include: { event: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    this.assertLiveStage(fight.event.lifecycle, input.override, input.reason);

    if (
      !['QUEUED', 'ON_DECK', 'IN_PROGRESS', 'PAUSED', 'COMPLETE'].includes(
        fight.status,
      ) &&
      !input.override
    ) {
      throw new Error('INVALID_RESULT_STATE');
    }
    if (hasRecordedResult(fight) && !input.override) {
      throw new Error('RESULT_ALREADY_RECORDED');
    }
    if (input.override && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const winnerAthleteId =
      input.winner === 'RED' ? fight.redAthleteId : fight.blueAthleteId;
    if (!winnerAthleteId) throw new Error('WINNER_NOT_PRESENT');

    if (fight.nextFightId) {
      const downstreamFight = await this.prisma.fight.findUnique({
        where: { id: fight.nextFightId },
        include: {
          timerState: {
            select: { state: true },
          },
        },
      });
      if (downstreamFight && isDownstreamFightLocked(downstreamFight)) {
        throw new Error('RESULT_CORRECTION_BLOCKED');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.fight.update({
        where: { id: input.fightId },
        data: {
          winnerAthleteId,
          loserAthleteId:
            winnerAthleteId === fight.redAthleteId
              ? fight.blueAthleteId ?? null
              : fight.redAthleteId ?? null,
          winMethod: input.method,
          notes: input.notes ?? null,
          status: 'CONFIRMED',
          confirmedByUserId: input.actorUserId,
          confirmedAt: now,
        },
      });

      const timer = await tx.timerState.findUnique({
        where: { fightId: input.fightId },
      });
      if (timer) {
        const extraElapsed =
          timer.state === 'RUNNING' && timer.startedAt
            ? Math.max(0, now.getTime() - timer.startedAt.getTime())
            : 0;

        await tx.timerState.update({
          where: { fightId: input.fightId },
          data: {
            state: 'FINISHED',
            startedAt: null,
            pausedAt: now,
            pausedMs: timer.pausedMs + extraElapsed,
            updatedByUserId: input.actorUserId,
          },
        });
      }

      const advanced = await this.propagateWinnerToNextFight(tx, updated);

      await this.audit.write(
        {
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
        },
        tx,
      );

      return { fight: updated, advanced };
    });
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
}
