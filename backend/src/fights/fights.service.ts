import { Injectable } from '@nestjs/common';
import type {
  EventLifecycle,
  FightSlot,
  FightStatus,
  Prisma,
  TimerPhaseEnum,
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
  compareQueueOrder,
  computeLiveStatuses,
  deriveLiveQueueBoard,
  type LiveFightStatus,
} from './live-queue.logic';
import {
  hasRecordedResult,
  isDownstreamFightLocked,
} from './result-safeguards';
import { propagateWinnerToNextFight } from './fight-progression';
import {
  isFightPlayable,
  isScheduleVisibleFight,
} from '../competition/fight-visibility';
import { buildScheduleRows } from '../schedule/schedule-order.logic';
import {
  buildTimerView,
  DEFAULT_REST_DURATION_SECONDS,
  getElapsedMs,
  getFightRoundDurationSeconds,
  getFightWinnerFromRounds,
  getRecordedRoundWinner,
  getRemainingMs,
  getRoundWinnerField,
  isAwaitingRoundResult,
  isPhaseExpired,
  type FightTimerSnapshot,
} from './fight-timer.logic';

// Allowed direct fight state transitions. Anything not listed requires an
// admin override + reason. CONFIRMED is terminal — once a result has been
// confirmed, you need a deliberate corrective action.
const FIGHT_STATE_TRANSITIONS: Record<FightStatus, FightStatus[]> = {
  QUEUED: ['ON_DECK'],
  ON_DECK: ['IN_PROGRESS', 'QUEUED'],
  IN_PROGRESS: ['PAUSED'],
  PAUSED: ['IN_PROGRESS'],
  COMPLETE: ['CONFIRMED'],
  CONFIRMED: [],
};

// Live queue board cache TTL. ~1 second is enough to absorb burst polling
// from many mat displays without going visibly stale.
const LIVE_BOARD_CACHE_TTL_MS = 800;

// Big service: scoring + timer + status + live boards for one fight at a time.
// Subscribes to FIGHT_STATE_TRANSITIONS for direct moves and falls back to
// override+reason for anything else. The `liveBoardCache` shaves load when
// dozens of clients poll the same board within a second.
@Injectable()
export class FightsService {
  private readonly liveBoardCache = new Map<
    string,
    {
      data: Awaited<ReturnType<FightsService['computeLiveQueueBoard']>>;
      ts: number;
    }
  >();

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

  private computeCompletionState(input: {
    totalVisibleFights: number;
    completedVisibleFights: number;
    hasActiveFight: boolean;
    needsReview: boolean;
  }): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW' {
    if (input.needsReview) return 'NEEDS_REVIEW';
    if (input.totalVisibleFights === 0) return 'NOT_STARTED';
    if (input.completedVisibleFights >= input.totalVisibleFights)
      return 'COMPLETED';
    if (input.completedVisibleFights > 0 || input.hasActiveFight)
      return 'IN_PROGRESS';
    return 'NOT_STARTED';
  }

  private resolveRoundDurationSeconds(input: {
    roundDurationSeconds?: number | null;
    eventWeightCategory?: {
      eventAgeGroup?: {
        categoryTemplateAgeGroup?: {
          roundDurationSeconds: number;
        } | null;
      } | null;
    } | null;
  }): number {
    return getFightRoundDurationSeconds(input);
  }

  private toTimerStateView(timer: FightTimerSnapshot | null) {
    return buildTimerView(timer);
  }

  private getWinnerAthleteIdBySlot(
    fight: {
      redAthleteId: string | null;
      blueAthleteId: string | null;
    },
    winner: FightSlot,
  ): string | null {
    return winner === 'RED' ? fight.redAthleteId : fight.blueAthleteId;
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
        mat: true,
        timerState: true,
      },
    });
  }

  /** Cached live board — expires after TTL or on explicit invalidation. */
  async getLiveQueueBoard(input: { organisationId: string; eventId: string }) {
    const cacheKey = `${input.organisationId}:${input.eventId}`;
    const cached = this.liveBoardCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < LIVE_BOARD_CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await this.computeLiveQueueBoard(input);
    this.liveBoardCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  }

  /** Call this to force-invalidate the board cache after mutations. */
  invalidateLiveBoardCache(organisationId: string, eventId: string) {
    this.liveBoardCache.delete(`${organisationId}:${eventId}`);
  }

  private async computeLiveQueueBoard(input: {
    organisationId: string;
    eventId: string;
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
      select: { id: true },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const [mats, sessions, fights] = await Promise.all([
      this.prisma.mat.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
        orderBy: { order: 'asc' },
      }),
      this.prisma.scheduleSession.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
        orderBy: { order: 'asc' },
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
        include: {
          mat: true,
          redAthlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              club: { select: { name: true, nameKa: true } },
            },
          },
          blueAthlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              club: { select: { name: true, nameKa: true } },
            },
          },
          winnerAthlete: {
            select: { id: true, firstName: true, lastName: true },
          },
          timerState: true,
          eventWeightCategory: {
            select: {
              categoryTemplateWeight: {
                select: { name: true, sortOrder: true },
              },
              eventAgeGroup: {
                select: {
                  categoryTemplateAgeGroup: {
                    select: {
                      name: true,
                      sortOrder: true,
                      roundDurationSeconds: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { eventWeightCategoryId: 'asc' },
          { categoryCode: 'asc' },
          { round: 'asc' },
          { boutNo: 'asc' },
        ],
      }),
    ]);

    const sessionOrderById = new Map(sessions.map((s) => [s.id, s.order]));
    const sessionNameById = new Map(sessions.map((s) => [s.id, s.name]));

    const scheduleRows = buildScheduleRows(fights).map((row) => ({
      ...row,
      liveStatus: 'PENDING' as LiveFightStatus,
    }));
    const globalQueueRows = scheduleRows.map((row) => ({
      ...row,
      matId: null,
      orderInMat: null,
      sessionOrder: row.sessionId
        ? (sessionOrderById.get(row.sessionId) ?? null)
        : null,
      isFinished: row.status === 'COMPLETE' || row.status === 'CONFIRMED',
    }));
    const liveStatuses = computeLiveStatuses(
      globalQueueRows.map((row) => ({
        id: row.id,
        matId: row.matId,
        orderInMat: row.orderInMat,
        sessionOrder: row.sessionOrder,
        orderInSession: row.orderInSession,
        scheduleOrder: row.scheduleOrder,
        status: row.status,
        isPlayable: row.isPlayable,
        isFinished: row.isFinished,
      })),
    );

    for (const row of scheduleRows) {
      row.liveStatus = liveStatuses.get(row.id) ?? 'PENDING';
    }

    const rowById = new Map(scheduleRows.map((row) => [row.id, row]));
    const fightById = new Map(fights.map((fight) => [fight.id, fight]));
    const board = deriveLiveQueueBoard(
      globalQueueRows.map((row) => ({
        ...row,
        liveStatus: liveStatuses.get(row.id) ?? 'PENDING',
      })),
    );

    const toFightRow = (fightId: string) => {
      const row = rowById.get(fightId);
      const fight = fightById.get(fightId);
      if (!row || !fight) return null;

      return {
        id: fight.id,
        // BF-2: row-version token so the client can pass expectedUpdatedAt when
        // recording a result (rejects stale concurrent writes).
        updatedAt: fight.updatedAt,
        categoryCode: row.categoryCode,
        categoryName: row.categoryName,
        ageGroupName: row.ageGroupName,
        competitionFormat: row.competitionFormat,
        round: fight.round,
        boutNo: fight.boutNo,
        bracketRoundLabel: row.bracketRoundLabel,
        scheduleOrder: row.scheduleOrder,
        status: row.status,
        liveStatus: row.liveStatus,
        isPlayable: row.isPlayable,
        redAthleteId: fight.redAthleteId ?? null,
        blueAthleteId: fight.blueAthleteId ?? null,
        winnerAthleteId: fight.winnerAthleteId ?? null,
        winMethod: fight.winMethod ?? null,
        notes: fight.notes ?? null,
        redDisplayName: row.redDisplayName,
        blueDisplayName: row.blueDisplayName,
        redDisplayNameKa: row.redDisplayNameKa,
        blueDisplayNameKa: row.blueDisplayNameKa,
        redClubName: fight.redAthlete?.club?.name ?? null,
        redClubNameKa: fight.redAthlete?.club?.nameKa ?? null,
        blueClubName: fight.blueAthlete?.club?.name ?? null,
        blueClubNameKa: fight.blueAthlete?.club?.nameKa ?? null,
        matId: row.matId,
        matName: row.matName,
        orderInMat: row.orderInMat,
        orderInSession: row.orderInSession,
        sessionId: row.sessionId ?? null,
        sessionName: row.sessionId
          ? (sessionNameById.get(row.sessionId) ?? null)
          : null,
        sessionOrder: row.sessionId
          ? (sessionOrderById.get(row.sessionId) ?? null)
          : null,
        scheduledAt: row.scheduledAt,
        timerState: this.toTimerStateView(fight.timerState),
      };
    };

    // Full queue order — lets the live UI render fights grouped by session.
    const orderedFightIds = [...globalQueueRows]
      .sort(compareQueueOrder)
      .map((row) => row.id);

    return {
      eventId: input.eventId,
      mats,
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
      })),
      allFights: orderedFightIds
        .map((id) => toFightRow(id))
        .filter((row): row is NonNullable<typeof row> => row != null),
      selectedMatId: null,
      currentFight: board.current ? toFightRow(board.current.id) : null,
      onDeckFight: board.onDeck ? toFightRow(board.onDeck.id) : null,
      nextFights: board.next
        .map((row) => toFightRow(row.id))
        .filter((row): row is NonNullable<typeof row> => row != null),
      queuePreview: board.queue
        .map((row) => toFightRow(row.id))
        .filter((row): row is NonNullable<typeof row> => row != null),
      completedFights: board.completed
        .map((row) => toFightRow(row.id))
        .filter((row): row is NonNullable<typeof row> => row != null),
    };
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
        timerState: true,
        mat: { select: { id: true, name: true } },
        eventWeightCategory: {
          select: {
            id: true,
            categoryTemplateWeight: { select: { name: true } },
            eventAgeGroup: {
              select: {
                categoryTemplateAgeGroup: {
                  select: { name: true, roundDurationSeconds: true },
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
          categoryFights.map((fight) => [
            `${fight.round}:${fight.boutNo}`,
            fight,
          ]),
        );

        const sourceByFightId = new Map<
          string,
          { redSourceFightId: string | null; blueSourceFightId: string | null }
        >();
        const visibleFights = categoryFights.filter((fight) => {
          const redSourceFightId =
            fight.round > openingRound
              ? (byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2 - 1}`)
                  ?.id ?? null)
              : null;
          const blueSourceFightId =
            fight.round > openingRound
              ? (byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)
                  ?.id ?? null)
              : null;
          sourceByFightId.set(fight.id, {
            redSourceFightId,
            blueSourceFightId,
          });
          return isScheduleVisibleFight({
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
            ? (scheduleOrderByFightId.get(source.redSourceFightId) ?? null)
            : null;
          const blueSourceScheduleOrder = source.blueSourceFightId
            ? (scheduleOrderByFightId.get(source.blueSourceFightId) ?? null)
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
            ? this.toTimerStateView(fight.timerState)
            : null;
          const isPlayable = isFightPlayable({
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
            stageLabel: roundStageLabel(
              fight.round,
              maxRound,
              competitionFormat,
            ),
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
                ? (byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2 - 1}`)
                    ?.boutNo ?? null)
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
                ? (byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)
                    ?.boutNo ?? null)
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
            sessionOrder: null,
            orderInSession: null,
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
            : (sortedBySchedule.find(
                (row) =>
                  row.id !== currentFight.id &&
                  row.liveStatus === 'UPCOMING' &&
                  (row.scheduleOrder ?? Number.MAX_SAFE_INTEGER) >
                    (currentFight.scheduleOrder ?? Number.MAX_SAFE_INTEGER),
              ) ?? null);

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
        const completedVisibleFights = rows.filter(
          (row) => row.isCompleted,
        ).length;
        const hasActiveFight = rows.some(
          (row) => row.status === 'IN_PROGRESS' || row.status === 'PAUSED',
        );

        return {
          eventWeightCategoryId,
          categoryCode:
            categoryFights[0]?.categoryCode ?? eventWeightCategoryId,
          categoryName:
            categoryFights[0]?.eventWeightCategory?.categoryTemplateWeight
              ?.name ??
            categoryFights[0]?.categoryCode ??
            eventWeightCategoryId,
          ageGroupName:
            categoryFights[0]?.eventWeightCategory?.eventAgeGroup
              ?.categoryTemplateAgeGroup?.name ?? null,
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
        (category) =>
          category.eventWeightCategoryId === input.eventWeightCategoryId,
      )
        ? input.eventWeightCategoryId
        : null) ??
      categories.find((category) => category.board.currentFight)
        ?.eventWeightCategoryId ??
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

  private async finalizeFightResult(
    tx: Prisma.TransactionClient,
    input: {
      fight: {
        id: string;
        organisationId: string;
        eventId: string;
        event: { lifecycle: EventLifecycle };
        redAthleteId: string | null;
        blueAthleteId: string | null;
        nextFightId: string | null;
        nextFightSlot: 'RED' | 'BLUE' | null;
      };
      actorUserId: string;
      winner: FightSlot;
      method: WinMethod;
      notes?: string | null;
      timerState?: FightTimerSnapshot | null;
      reason?: string | null;
      override?: boolean;
      auditAction: string;
    },
  ) {
    const winnerAthleteId = this.getWinnerAthleteIdBySlot(
      input.fight,
      input.winner,
    );
    if (!winnerAthleteId) throw new Error('WINNER_NOT_PRESENT');

    const now = new Date();
    const updated = await tx.fight.update({
      where: { id: input.fight.id },
      data: {
        winnerAthleteId,
        loserAthleteId:
          winnerAthleteId === input.fight.redAthleteId
            ? (input.fight.blueAthleteId ?? null)
            : (input.fight.redAthleteId ?? null),
        winMethod: input.method,
        notes: input.notes ?? null,
        status: 'CONFIRMED',
        confirmedByUserId: input.actorUserId,
        confirmedAt: now,
      },
    });

    const timer =
      input.timerState ??
      (await tx.timerState.findUnique({
        where: { fightId: input.fight.id },
      }));
    let finalizedTimer: FightTimerSnapshot | null = null;
    if (timer) {
      const extraElapsed =
        timer.state === 'RUNNING' && timer.startedAt
          ? Math.max(0, now.getTime() - timer.startedAt.getTime())
          : 0;

      finalizedTimer = await tx.timerState.update({
        where: { fightId: input.fight.id },
        data: {
          state: 'FINISHED',
          phase: 'FINISHED',
          startedAt: null,
          pausedAt: now,
          pausedMs: timer.pausedMs + extraElapsed,
          phaseDurationSeconds: 0,
          updatedByUserId: input.actorUserId,
        },
      });
    }

    const advanced = await propagateWinnerToNextFight(tx, updated);

    // Auto-complete the event when all playable fights are done
    if (input.fight.event.lifecycle === 'LIVE') {
      const remainingPlayable = await tx.fight.count({
        where: {
          eventId: input.fight.eventId,
          redAthleteId: { not: null },
          blueAthleteId: { not: null },
          winnerAthleteId: null,
          status: { notIn: ['COMPLETE', 'CONFIRMED'] },
        },
      });
      if (remainingPlayable === 0) {
        await tx.event.update({
          where: { id: input.fight.eventId },
          data: { lifecycle: 'COMPLETED' },
        });
        await this.audit.write(
          {
            organisationId: input.fight.organisationId,
            eventId: input.fight.eventId,
            actorUserId: input.actorUserId,
            action: 'EVENT_STAGE_AUTO_ADVANCED',
            entityType: 'event',
            entityId: input.fight.eventId,
            before: { lifecycle: 'LIVE' } as Prisma.JsonValue,
            after: {
              lifecycle: 'COMPLETED',
              reason: 'All fights confirmed',
            } as Prisma.JsonValue,
          },
          tx,
        );
      }
    }

    await this.audit.write(
      {
        organisationId: input.fight.organisationId,
        eventId: input.fight.eventId,
        actorUserId: input.actorUserId,
        action: input.auditAction,
        entityType: 'fight',
        entityId: input.fight.id,
        before: input.fight as unknown as Prisma.JsonValue,
        after: updated as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: input.override ?? false,
      },
      tx,
    );

    return { fight: updated, advanced, timer: finalizedTimer };
  }

  async recordRoundResult(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    winner: FightSlot;
    expectedUpdatedAt?: string | null;
  }) {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
      include: {
        event: true,
        timerState: true,
      },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');
    this.assertLiveStage(fight.event.lifecycle);

    if (!fight.timerState) throw new Error('TIMER_NOT_INITIALIZED');
    if (!['ROUND', 'REST'].includes(fight.timerState.phase)) {
      throw new Error('INVALID_TIMER_PHASE');
    }
    if (
      fight.timerState.phase === 'ROUND' &&
      fight.timerState.state === 'RUNNING' &&
      getRemainingMs(fight.timerState, new Date()) > 0
    ) {
      throw new Error('ROUND_STILL_RUNNING');
    }
    if (input.expectedUpdatedAt) {
      const expectedMs = new Date(input.expectedUpdatedAt).getTime();
      if (
        Number.isNaN(expectedMs) ||
        fight.timerState.updatedAt.getTime() !== expectedMs
      ) {
        throw new Error('TIMER_STALE_UPDATE');
      }
    }

    const winnerField = getRoundWinnerField(fight.timerState.round);
    if (fight.timerState[winnerField]) {
      throw new Error('ROUND_RESULT_ALREADY_SET');
    }

    const roundResult = await this.prisma.$transaction(async (tx) => {
      const latestTimer = await tx.timerState.findUnique({
        where: { fightId: input.fightId },
      });
      if (!latestTimer) throw new Error('TIMER_NOT_INITIALIZED');
      if (!['ROUND', 'REST'].includes(latestTimer.phase)) {
        throw new Error('INVALID_TIMER_PHASE');
      }

      const latestWinnerField = getRoundWinnerField(latestTimer.round);
      if (latestTimer[latestWinnerField]) {
        throw new Error('ROUND_RESULT_ALREADY_SET');
      }

      const redRoundWins =
        latestTimer.redRoundWins + (input.winner === 'RED' ? 1 : 0);
      const blueRoundWins =
        latestTimer.blueRoundWins + (input.winner === 'BLUE' ? 1 : 0);

      const updatedTimer = await tx.timerState.update({
        where: { fightId: input.fightId },
        data: {
          [latestWinnerField]: input.winner,
          redRoundWins,
          blueRoundWins,
          updatedByUserId: input.actorUserId,
          ...(latestTimer.phase === 'ROUND'
            ? {
                state: 'PAUSED' as const,
                startedAt: null,
                pausedAt: new Date(),
                pausedMs: latestTimer.phaseDurationSeconds * 1000,
              }
            : {}),
        },
      });

      const fightWinner = getFightWinnerFromRounds({
        redRoundWins,
        blueRoundWins,
      });

      if (fightWinner || latestTimer.round >= 3) {
        return this.finalizeFightResult(tx, {
          fight,
          actorUserId: input.actorUserId,
          winner: fightWinner ?? input.winner,
          method: 'POINTS',
          timerState: updatedTimer,
          auditAction: 'FIGHT_ROUND_RESULT_SET',
        }).then((result) => ({
          ...result,
          scheduleEventType: 'LIVE_FIGHT_FINISHED' as const,
        }));
      }

      if (latestTimer.phase === 'REST') {
        const updatedFight = await tx.fight.update({
          where: { id: input.fightId },
          data: {
            status: latestTimer.state === 'PAUSED' ? 'PAUSED' : 'IN_PROGRESS',
          },
        });

        await this.audit.write(
          {
            organisationId: fight.organisationId,
            eventId: fight.eventId,
            actorUserId: input.actorUserId,
            action: 'FIGHT_ROUND_RESULT_SET',
            entityType: 'fight',
            entityId: input.fightId,
            before: latestTimer as unknown as Prisma.JsonValue,
            after: updatedTimer as unknown as Prisma.JsonValue,
          },
          tx,
        );

        return {
          fight: updatedFight,
          advanced: null,
          timer: updatedTimer,
          scheduleEventType: 'LIVE_ROUND_RESULT_SAVED' as const,
        };
      }

      const restTimer = await tx.timerState.update({
        where: { fightId: input.fightId },
        data: {
          phase: 'REST',
          state: 'RUNNING',
          startedAt: new Date(),
          pausedAt: null,
          pausedMs: 0,
          phaseDurationSeconds: latestTimer.restDurationSeconds,
          updatedByUserId: input.actorUserId,
        },
      });

      const updatedFight = await tx.fight.update({
        where: { id: input.fightId },
        data: { status: 'IN_PROGRESS' },
      });

      await this.audit.write(
        {
          organisationId: fight.organisationId,
          eventId: fight.eventId,
          actorUserId: input.actorUserId,
          action: 'FIGHT_ROUND_RESULT_SET',
          entityType: 'fight',
          entityId: input.fightId,
          before: latestTimer as unknown as Prisma.JsonValue,
          after: restTimer as unknown as Prisma.JsonValue,
        },
        tx,
      );

      return {
        fight: updatedFight,
        advanced: null,
        timer: restTimer,
        scheduleEventType: 'LIVE_REST_STARTED' as const,
      };
    });

    this.invalidateLiveBoardCache(fight.organisationId, fight.eventId);
    return roundResult;
  }

  async advanceExpiredTimers(now = new Date()) {
    const activeTimers = await this.prisma.timerState.findMany({
      where: {
        state: 'RUNNING',
        phase: { in: ['ROUND', 'REST'] },
        startedAt: { not: null },
        fight: {
          status: { in: ['IN_PROGRESS', 'PAUSED'] },
          event: { lifecycle: 'LIVE' },
        },
      },
      include: {
        fight: true,
      },
    });

    const transitions: Array<{
      eventId: string;
      matId: string | null;
      fight: Prisma.FightGetPayload<object>;
      timer: ReturnType<FightsService['toTimerStateView']>;
      scheduleEventType: string;
      advancedFight: Prisma.FightGetPayload<object> | null;
    }> = [];

    for (const timer of activeTimers) {
      if (!isPhaseExpired(timer, now)) continue;

      const transition = await this.prisma.$transaction(async (tx) => {
        const currentTimer = await tx.timerState.findUnique({
          where: { fightId: timer.fightId },
          include: { fight: true },
        });
        if (!currentTimer || !isPhaseExpired(currentTimer, now)) {
          return null;
        }

        if (currentTimer.phase === 'ROUND') {
          const updatedTimer = await tx.timerState.update({
            where: { fightId: currentTimer.fightId },
            data: {
              phase: 'REST',
              state: 'RUNNING',
              startedAt: now,
              pausedAt: null,
              pausedMs: 0,
              phaseDurationSeconds: currentTimer.restDurationSeconds,
            },
          });
          const updatedFight = await tx.fight.update({
            where: { id: currentTimer.fightId },
            data: { status: 'IN_PROGRESS' },
          });
          await this.audit.write(
            {
              organisationId: currentTimer.organisationId,
              eventId: currentTimer.fight.eventId,
              action: 'FIGHT_ROUND_TIMER_EXPIRED',
              entityType: 'fight',
              entityId: currentTimer.fightId,
              before: currentTimer as unknown as Prisma.JsonValue,
              after: updatedTimer as unknown as Prisma.JsonValue,
            },
            tx,
          );

          return {
            eventId: currentTimer.fight.eventId,
            matId: currentTimer.fight.matId,
            fight: updatedFight,
            timer: this.toTimerStateView(updatedTimer),
            scheduleEventType: 'LIVE_REST_STARTED',
            advancedFight: null,
          };
        }

        if (!getRecordedRoundWinner(currentTimer)) {
          const updatedTimer = await tx.timerState.update({
            where: { fightId: currentTimer.fightId },
            data: {
              state: 'PAUSED',
              startedAt: null,
              pausedAt: now,
              pausedMs: currentTimer.phaseDurationSeconds * 1000,
            },
          });
          const updatedFight = await tx.fight.update({
            where: { id: currentTimer.fightId },
            data: { status: 'PAUSED' },
          });
          await this.audit.write(
            {
              organisationId: currentTimer.organisationId,
              eventId: currentTimer.fight.eventId,
              action: 'FIGHT_REST_BLOCKED_MISSING_ROUND_RESULT',
              entityType: 'fight',
              entityId: currentTimer.fightId,
              before: currentTimer as unknown as Prisma.JsonValue,
              after: updatedTimer as unknown as Prisma.JsonValue,
            },
            tx,
          );

          return {
            eventId: currentTimer.fight.eventId,
            matId: currentTimer.fight.matId,
            fight: updatedFight,
            timer: this.toTimerStateView(updatedTimer),
            scheduleEventType: 'LIVE_NEXT_ROUND_BLOCKED',
            advancedFight: null,
          };
        }

        const updatedTimer = await tx.timerState.update({
          where: { fightId: currentTimer.fightId },
          data: {
            phase: 'ROUND',
            state: 'RUNNING',
            round: currentTimer.round + 1,
            startedAt: now,
            pausedAt: null,
            pausedMs: 0,
            phaseDurationSeconds: currentTimer.roundDurationSeconds,
          },
        });
        const updatedFight = await tx.fight.update({
          where: { id: currentTimer.fightId },
          data: { status: 'IN_PROGRESS' },
        });
        await this.audit.write(
          {
            organisationId: currentTimer.organisationId,
            eventId: currentTimer.fight.eventId,
            action: 'FIGHT_REST_COMPLETED',
            entityType: 'fight',
            entityId: currentTimer.fightId,
            before: currentTimer as unknown as Prisma.JsonValue,
            after: updatedTimer as unknown as Prisma.JsonValue,
          },
          tx,
        );

        return {
          eventId: currentTimer.fight.eventId,
          matId: currentTimer.fight.matId,
          fight: updatedFight,
          timer: this.toTimerStateView(updatedTimer),
          scheduleEventType: 'LIVE_NEXT_ROUND_STARTED',
          advancedFight: null,
        };
      });

      if (transition) {
        transitions.push(transition);
      }
    }

    const invalidated = new Set<string>();
    for (const t of transitions) {
      const key = `${t.fight.organisationId}:${t.eventId}`;
      if (!invalidated.has(key)) {
        this.invalidateLiveBoardCache(t.fight.organisationId, t.eventId);
        invalidated.add(key);
      }
    }

    return transitions;
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
    expectedUpdatedAt?: string | null;
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
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
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
      include: {
        event: true,
        timerState: true,
        eventWeightCategory: {
          select: {
            eventAgeGroup: {
              select: {
                categoryTemplateAgeGroup: {
                  select: { roundDurationSeconds: true },
                },
              },
            },
          },
        },
      },
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
    const resolvedRoundDurationSeconds =
      this.resolveRoundDurationSeconds(fight);
    if (input.to === 'IN_PROGRESS' && !fight.roundDurationSeconds) {
      updateData.roundDurationSeconds = resolvedRoundDurationSeconds;
    }
    if (input.to === 'CONFIRMED') {
      updateData.confirmedByUserId = input.actorUserId;
      updateData.confirmedAt = new Date();
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
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
              phase: 'ROUND',
              round: 1,
              startedAt: now,
              pausedAt: null,
              pausedMs: 0,
              phaseDurationSeconds: resolvedRoundDurationSeconds,
              roundDurationSeconds: resolvedRoundDurationSeconds,
              restDurationSeconds: DEFAULT_REST_DURATION_SECONDS,
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
              phase: 'ROUND',
              round: timer.round || 1,
              startedAt: now,
              pausedAt: null,
              pausedMs: 0,
              phaseDurationSeconds:
                timer.roundDurationSeconds || resolvedRoundDurationSeconds,
              roundDurationSeconds:
                timer.roundDurationSeconds || resolvedRoundDurationSeconds,
              restDurationSeconds:
                timer.restDurationSeconds || DEFAULT_REST_DURATION_SECONDS,
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
        advanced = await propagateWinnerToNextFight(tx, updated);
      }

      return { fight: updated, advanced };
    });

    this.invalidateLiveBoardCache(input.organisationId, fight.eventId);
    return txResult;
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
      include: {
        timerState: true,
        event: true,
        eventWeightCategory: {
          select: {
            eventAgeGroup: {
              select: {
                categoryTemplateAgeGroup: {
                  select: { roundDurationSeconds: true },
                },
              },
            },
          },
        },
      },
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
    let phase: TimerPhaseEnum = existing?.phase ?? 'ROUND';
    let phaseDurationSeconds =
      existing?.phaseDurationSeconds ?? this.resolveRoundDurationSeconds(fight);
    let round = input.round ?? existing?.round ?? 1;
    let fightStatusUpdate: FightStatus | null = null;

    switch (input.action) {
      case 'START':
        newState = 'RUNNING';
        phase = existing?.phase ?? 'ROUND';
        round = input.round ?? existing?.round ?? 1;
        startedAt = now;
        pausedAt = null;
        pausedMs = 0;
        phaseDurationSeconds =
          phase === 'REST'
            ? (existing?.restDurationSeconds ?? DEFAULT_REST_DURATION_SECONDS)
            : (existing?.roundDurationSeconds ??
              this.resolveRoundDurationSeconds(fight));
        fightStatusUpdate = 'IN_PROGRESS';
        break;
      case 'PAUSE':
        if (existing?.state !== 'RUNNING') throw new Error('TIMER_NOT_RUNNING');
        newState = 'PAUSED';
        pausedAt = now;
        pausedMs = getElapsedMs(existing, now);
        startedAt = null;
        phase = existing.phase;
        phaseDurationSeconds = existing.phaseDurationSeconds;
        round = existing.round;
        fightStatusUpdate = 'PAUSED';
        break;
      case 'RESUME':
        if (existing?.state !== 'PAUSED') throw new Error('TIMER_NOT_PAUSED');
        newState = 'RUNNING';
        startedAt = now;
        pausedAt = null;
        pausedMs = existing.pausedMs;
        phase = existing.phase;
        phaseDurationSeconds = existing.phaseDurationSeconds;
        round = existing.round;
        fightStatusUpdate = 'IN_PROGRESS';
        break;
      case 'RESET':
        newState = 'IDLE';
        phase = 'ROUND';
        round = 1;
        startedAt = null;
        pausedAt = null;
        pausedMs = 0;
        phaseDurationSeconds = this.resolveRoundDurationSeconds(fight);
        fightStatusUpdate = 'PAUSED';
        break;
    }

    const timerData = {
      state: newState,
      phase,
      round,
      startedAt,
      pausedAt,
      pausedMs,
      phaseDurationSeconds,
      roundDurationSeconds:
        existing?.roundDurationSeconds ??
        this.resolveRoundDurationSeconds(fight),
      restDurationSeconds:
        existing?.restDurationSeconds ?? DEFAULT_REST_DURATION_SECONDS,
      redRoundWins: existing?.redRoundWins ?? 0,
      blueRoundWins: existing?.blueRoundWins ?? 0,
      round1Winner: existing?.round1Winner ?? null,
      round2Winner: existing?.round2Winner ?? null,
      round3Winner: existing?.round3Winner ?? null,
      updatedByUserId: input.actorUserId,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.timerState.upsert({
        where: { fightId: input.fightId },
        create: {
          fightId: input.fightId,
          organisationId: input.organisationId,
          ...timerData,
        },
        update: timerData,
      });

      if (fightStatusUpdate) {
        await tx.fight.update({
          where: { id: fight.id },
          data: { status: fightStatusUpdate },
        });
      }

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

    this.invalidateLiveBoardCache(input.organisationId, fight.eventId);
    return { timer: result, eventId: fight.eventId, matId: fight.matId };
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
    expectedUpdatedAt?: string | null;
  }) {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
      include: { event: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');

    // BF-2: optimistic lock. The client echoes the fight.updatedAt it last saw;
    // if the row changed since (another judge already scored it), reject the
    // stale write instead of last-writer-wins silently overwriting the result.
    // Mirrors the TIMER_STALE_UPDATE guard already used by the timer endpoints.
    if (input.expectedUpdatedAt) {
      const expectedMs = new Date(input.expectedUpdatedAt).getTime();
      if (
        Number.isNaN(expectedMs) ||
        expectedMs !== fight.updatedAt.getTime()
      ) {
        throw new Error('FIGHT_STALE_UPDATE');
      }
    }

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

    const result = await this.prisma.$transaction(async (tx) => {
      return this.finalizeFightResult(tx, {
        fight,
        actorUserId: input.actorUserId,
        winner: input.winner,
        method: input.method,
        notes: input.notes ?? null,
        reason: input.reason ?? null,
        override: input.override ?? false,
        auditAction: input.override
          ? 'FIGHT_RESULT_AMENDED'
          : 'FIGHT_RESULT_SET',
      });
    });
    this.invalidateLiveBoardCache(input.organisationId, fight.eventId);
    return result;
  }

}
