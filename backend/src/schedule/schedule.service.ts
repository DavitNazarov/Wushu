import { Injectable } from '@nestjs/common';
import type { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { canManageSchedule, isEventReadOnly } from '../events/lifecycle-rules';
import {
  computeLiveStatuses,
  type LiveFightStatus,
} from '../fights/live-queue.logic';
import {
  buildScheduleRows,
} from './schedule-order.logic';
import { planAutoScheduleOrder } from './auto-schedule-order.logic';

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

  async listSessions(organisationId: string, eventId: string) {
    return this.prisma.scheduleSession.findMany({
      where: { organisationId, eventId },
      orderBy: { order: 'asc' },
    });
  }

  async upsertSession(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    id?: string;
    name: string;
    startTime: string;
    endTime: string;
    order: number;
  }) {
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('INVALID_SESSION_TIMES');
    }
    if (endTime <= startTime) throw new Error('SESSION_END_BEFORE_START');

    if (input.id) {
      const existing = await this.prisma.scheduleSession.findFirst({
        where: { id: input.id, organisationId: input.organisationId, eventId: input.eventId },
      });
      if (!existing) throw new Error('SESSION_NOT_FOUND');
      return this.prisma.scheduleSession.update({
        where: { id: input.id },
        data: { name: input.name, startTime, endTime, order: input.order },
      });
    }
    return this.prisma.scheduleSession.create({
      data: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        name: input.name,
        startTime,
        endTime,
        order: input.order,
      },
    });
  }

  async deleteSession(input: {
    organisationId: string;
    eventId: string;
    sessionId: string;
  }) {
    const existing = await this.prisma.scheduleSession.findFirst({
      where: { id: input.sessionId, organisationId: input.organisationId, eventId: input.eventId },
    });
    if (!existing) throw new Error('SESSION_NOT_FOUND');

    // Unlink fights from this session before deleting
    await this.prisma.fight.updateMany({
      where: { sessionId: input.sessionId },
      data: { sessionId: null, orderInSession: null },
    });

    return this.prisma.scheduleSession.delete({ where: { id: input.sessionId } });
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
      orderBy: [
        { eventWeightCategoryId: 'asc' },
        { categoryCode: 'asc' },
        { round: 'asc' },
        { boutNo: 'asc' },
      ],
    });

    const scheduleRows = buildScheduleRows(fights).map((row) => ({
      ...row,
      liveStatus: 'PENDING' as LiveFightStatus,
    }));

    const liveStatuses = computeLiveStatuses(
      scheduleRows.map((row) => ({
        id: row.id,
        matId: row.matId,
        orderInMat: row.orderInMat,
        sessionOrder: null,
        orderInSession: row.orderInSession,
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
    useSessions?: boolean;
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
      include: {
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
    });
    const mats = await this.prisma.mat.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      orderBy: { order: 'asc' },
    });

    if (mats.length === 0) throw new Error('NO_MATS');
    const { fights: schedulableFights, diagnostics } = planAutoScheduleOrder(fights);
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

    // Load sessions if requested
    const sessions = input.useSessions
      ? await this.prisma.scheduleSession.findMany({
          where: { organisationId: input.organisationId, eventId: input.eventId },
          orderBy: { order: 'asc' },
        })
      : [];

    const matNextTime = new Map<string, number>();
    const athleteLastFightEndTime = new Map<string, number>();
    for (const mat of mats) matNextTime.set(mat.id, baseTime);

    const updates: Array<{
      id: string;
      matId: string;
      orderInMat: number;
      scheduledStartTime: Date;
      sessionId: string | null;
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

      // If sessions are defined, enforce session boundaries.
      // When the earliest available time is past the current session's end,
      // advance all mat clocks to the next session's start time and retry.
      if (sessions.length > 0) {
        let advanced = true;
        while (advanced) {
          advanced = false;
          // Find which session this time falls into or is past
          for (const session of sessions) {
            const sessionEnd = session.endTime.getTime();
            if (earliestStart >= sessionEnd) {
              // Find the next session after this one
              const nextSession = sessions.find(
                (s) => s.startTime.getTime() > sessionEnd,
              );
              if (nextSession) {
                const nextStart = nextSession.startTime.getTime();
                // Advance all mats to the next session start if they're stuck in the gap
                for (const mat of mats) {
                  const current = matNextTime.get(mat.id) ?? baseTime;
                  if (current < nextStart) {
                    matNextTime.set(mat.id, nextStart);
                  }
                }
                // Recalculate earliest start with updated mat times
                earliestStart = Infinity;
                bestMatId = mats[0].id;
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
                advanced = true;
              }
              break;
            }
          }
        }
      }

      // Determine which session this fight belongs to
      const sessionId =
        sessions.find(
          (s) =>
            earliestStart >= s.startTime.getTime() &&
            earliestStart < s.endTime.getTime(),
        )?.id ?? null;

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
        sessionId,
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
            sessionId: upd.sessionId,
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
            restGapDiagnostics: diagnostics,
          } as unknown as Prisma.JsonValue,
          override: input.override ?? false,
          reason: input.reason ?? null,
        },
        tx,
      );
    });

    return {
      updates,
      diagnostics,
    };
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

  // ── Session-based scheduling (no mats required) ──────────────────────────

  /**
   * Generate a session-based schedule.
   * Distributes fights into existing sessions by capacity.
   * Creates additional sessions automatically on overflow.
   */
  async generateSchedule(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    avgBoutSeconds: number;
    bufferSeconds: number;
    override?: boolean;
    reason?: string | null;
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({ event, override: input.override, reason: input.reason ?? null });

    const sessions = await this.prisma.scheduleSession.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      orderBy: { order: 'asc' },
    });
    if (sessions.length === 0) throw new Error('NO_SESSIONS');

    const fights = await this.prisma.fight.findMany({
      where: { organisationId: input.organisationId, eventId: input.eventId },
      include: {
        eventWeightCategory: {
          select: {
            categoryTemplateWeight: { select: { name: true, sortOrder: true } },
            eventAgeGroup: {
              select: { categoryTemplateAgeGroup: { select: { name: true, sortOrder: true } } },
            },
          },
        },
      },
    });

    const { fights: orderedFights, diagnostics } = planAutoScheduleOrder(fights);
    if (orderedFights.length === 0) throw new Error('NO_SCHEDULABLE_FIGHTS');

    const boutMs = (input.avgBoutSeconds + input.bufferSeconds) * 1000;

    // Build mutable session list (we may append auto-created overflow sessions)
    const sessionList = [...sessions];

    // Compute capacity per session
    function sessionCapacity(s: { startTime: Date; endTime: Date }): number {
      const durationMs = s.endTime.getTime() - s.startTime.getTime();
      return Math.max(1, Math.floor(durationMs / boutMs));
    }

    type SessionAssignment = {
      sessionId: string;
      fights: string[]; // fight IDs in order
    };
    const assignments: SessionAssignment[] = sessionList.map((s) => ({ sessionId: s.id, fights: [] }));

    let sessionIdx = 0;
    for (const fight of orderedFights) {
      // Find a session with remaining capacity
      while (sessionIdx < assignments.length) {
        const cap = sessionCapacity(sessionList[sessionIdx]);
        if (assignments[sessionIdx].fights.length < cap) break;
        sessionIdx++;
      }

      // Overflow: create a new session
      if (sessionIdx >= assignments.length) {
        const last = sessionList[sessionList.length - 1];
        const gapMs = 60 * 60 * 1000; // 1 hour gap
        const newStart = new Date(last.endTime.getTime() + gapMs);
        // New session duration = same as last session
        const lastDuration = last.endTime.getTime() - last.startTime.getTime();
        const newEnd = new Date(newStart.getTime() + lastDuration);

        const newSession = await this.prisma.scheduleSession.create({
          data: {
            organisationId: input.organisationId,
            eventId: input.eventId,
            name: `Session ${sessionList.length + 1}`,
            startTime: newStart,
            endTime: newEnd,
            order: sessionList.length + 1,
          },
        });
        sessionList.push(newSession);
        assignments.push({ sessionId: newSession.id, fights: [] });
        // sessionIdx now points to the new session
      }

      assignments[sessionIdx].fights.push(fight.id);
    }

    // Clear all session assignments, then apply new ones in a single batch transaction
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.fight.updateMany({
        where: { organisationId: input.organisationId, eventId: input.eventId },
        data: { sessionId: null, orderInSession: null },
      }),
    ];
    for (const assignment of assignments) {
      for (let i = 0; i < assignment.fights.length; i++) {
        writes.push(this.prisma.fight.update({
          where: { id: assignment.fights[i] },
          data: { sessionId: assignment.sessionId, orderInSession: i + 1 },
        }));
      }
    }
    writes.push(this.prisma.auditLog.create({
      data: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        action: 'SCHEDULE_AUTO_GENERATED',
        entityType: 'event',
        entityId: input.eventId,
        after: {
          sessionCount: assignments.length,
          fightCount: orderedFights.length,
          avgBoutSeconds: input.avgBoutSeconds,
          bufferSeconds: input.bufferSeconds,
          restGapDiagnostics: diagnostics,
        } as Prisma.InputJsonValue,
        override: input.override ?? false,
        reason: input.reason ?? null,
      },
    }));
    await this.prisma.$transaction(writes);

    return { sessionCount: assignments.length, fightCount: orderedFights.length, diagnostics };
  }

  /**
   * Move a fight to a different position within a session or to another session.
   * insertAfterOrder: 0 = prepend, N = insert after Nth fight.
   * Returns gap violations (fightIds of athletes with < 10-fight gap).
   */
  async moveFightToSession(input: {
    organisationId: string;
    fightId: string;
    actorUserId: string;
    toSessionId: string | null;
    insertAfterOrder: number;
    override?: boolean;
    reason?: string | null;
  }) {
    const fight = await this.prisma.fight.findFirst({
      where: { id: input.fightId, organisationId: input.organisationId },
      include: { event: true },
    });
    if (!fight) throw new Error('FIGHT_NOT_FOUND');
    this.assertScheduleMutable({ event: fight.event, override: input.override, reason: input.reason ?? null });

    const fromSessionId = fight.sessionId;

    // Fetch source, target, and all-event fights in parallel
    const [sourceFights, targetFights, allSessionFights] = await Promise.all([
      fromSessionId
        ? this.prisma.fight.findMany({
            where: { sessionId: fromSessionId, id: { not: input.fightId } },
            orderBy: { orderInSession: 'asc' },
            select: { id: true, orderInSession: true, redAthleteId: true, blueAthleteId: true },
          })
        : Promise.resolve([]),
      input.toSessionId
        ? this.prisma.fight.findMany({
            where: {
              sessionId: input.toSessionId,
              id: fromSessionId === input.toSessionId ? { not: input.fightId } : undefined,
            },
            orderBy: { orderInSession: 'asc' },
            select: { id: true, orderInSession: true, redAthleteId: true, blueAthleteId: true },
          })
        : Promise.resolve([]),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          sessionId: { not: null },
          orderInSession: { not: null },
        },
        include: { scheduleSession: { select: { order: true } } },
        orderBy: [{ scheduleSession: { order: 'asc' } }, { orderInSession: 'asc' }],
      }),
    ]);

    // Build all DB writes upfront, then execute in a single transaction batch
    const writes: Prisma.PrismaPromise<unknown>[] = [];

    // Repack source session — only update fights whose position actually changed
    for (let i = 0; i < sourceFights.length; i++) {
      const newOrder = i + 1;
      if (sourceFights[i].orderInSession !== newOrder) {
        writes.push(this.prisma.fight.update({ where: { id: sourceFights[i].id }, data: { orderInSession: newOrder } }));
      }
    }

    if (input.toSessionId === null) {
      // Unassign
      writes.push(this.prisma.fight.update({
        where: { id: input.fightId },
        data: { sessionId: null, orderInSession: null },
      }));
    } else {
      // Insert into target session
      const insertAt = Math.max(0, Math.min(targetFights.length, input.insertAfterOrder));
      const ids = targetFights.map((f) => f.id);
      ids.splice(insertAt, 0, input.fightId);
      for (let i = 0; i < ids.length; i++) {
        writes.push(this.prisma.fight.update({
          where: { id: ids[i] },
          data: { sessionId: input.toSessionId, orderInSession: i + 1 },
        }));
      }
    }

    // Audit write
    writes.push(this.prisma.auditLog.create({
      data: {
        organisationId: input.organisationId,
        eventId: fight.eventId,
        actorUserId: input.actorUserId,
        action: 'FIGHT_MOVED',
        entityType: 'fight',
        entityId: input.fightId,
        before: { sessionId: fromSessionId, orderInSession: fight.orderInSession } as Prisma.InputJsonValue,
        after: { sessionId: input.toSessionId, insertAfterOrder: input.insertAfterOrder } as Prisma.InputJsonValue,
        override: input.override ?? false,
        reason: input.reason ?? null,
      },
    }));

    await this.prisma.$transaction(writes);

    const gapViolations = this.checkGapViolations(allSessionFights);
    return { ok: true, eventId: fight.eventId, gapViolations };
  }

  /**
   * Bulk-reorder sessions by providing session IDs in new order.
   */
  async reorderSessions(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    sessionIds: string[];
  }) {
    await this.prisma.$transaction(
      input.sessionIds.map((id, idx) =>
        this.prisma.scheduleSession.update({
          where: { id },
          data: { order: idx + 1 },
        }),
      ),
    );
    await this.audit.write({
      organisationId: input.organisationId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      action: 'SCHEDULE_AUTO_GENERATED',
      entityType: 'event',
      entityId: input.eventId,
      after: { reorderedSessions: input.sessionIds } as unknown as Prisma.JsonValue,
      override: false,
      reason: null,
    });
  }

  /**
   * Bulk-reorder fights within a session.
   * orderedFightIds must contain all fight IDs currently in the session.
   * Recalculates orderInSession as sequential 1,2,3...
   */
  async updateFightOrder(input: {
    organisationId: string;
    sessionId: string;
    actorUserId: string;
    orderedFightIds: string[];
  }) {
    const session = await this.prisma.scheduleSession.findFirst({
      where: { id: input.sessionId, organisationId: input.organisationId },
    });
    if (!session) throw new Error('SESSION_NOT_FOUND');

    const event = await this.prisma.event.findFirst({
      where: { id: session.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({ event });

    const currentFights = await this.prisma.fight.findMany({
      where: { sessionId: input.sessionId },
      select: { id: true },
    });
    const currentIds = new Set(currentFights.map((f) => f.id));
    const inputIds = new Set(input.orderedFightIds);

    // Validate: input must contain exactly the same fight IDs as the session
    if (currentIds.size !== inputIds.size || ![...currentIds].every((id) => inputIds.has(id))) {
      throw new Error('FIGHT_IDS_MISMATCH');
    }

    const writes: Prisma.PrismaPromise<unknown>[] = input.orderedFightIds.map(
      (id, i) => this.prisma.fight.update({ where: { id }, data: { orderInSession: i + 1 } }),
    );
    writes.push(this.prisma.auditLog.create({
      data: {
        organisationId: input.organisationId,
        eventId: session.eventId,
        actorUserId: input.actorUserId,
        action: 'FIGHT_ORDER_UPDATED',
        entityType: 'scheduleSession',
        entityId: input.sessionId,
        after: { orderedFightIds: input.orderedFightIds } as Prisma.InputJsonValue,
        override: false,
        reason: null,
      },
    }));
    await this.prisma.$transaction(writes);

    return { ok: true, eventId: session.eventId };
  }

  /**
   * Returns sessions with their ordered fights for an event.
   * This is the authoritative schedule view.
   */
  async getEventSchedule(params: {
    organisationId: string;
    eventId: string;
  }) {
    const [sessions, fights] = await Promise.all([
      this.prisma.scheduleSession.findMany({
        where: { organisationId: params.organisationId, eventId: params.eventId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: params.organisationId,
          eventId: params.eventId,
          sessionId: { not: null },
        },
        include: {
          redAthlete: { select: { id: true, firstName: true, lastName: true } },
          blueAthlete: { select: { id: true, firstName: true, lastName: true } },
          winnerAthlete: { select: { id: true, firstName: true, lastName: true } },
          eventWeightCategory: {
            select: {
              categoryTemplateWeight: { select: { name: true, sortOrder: true } },
              eventAgeGroup: {
                select: {
                  categoryTemplateAgeGroup: { select: { name: true, sortOrder: true } },
                },
              },
            },
          },
        },
        orderBy: { orderInSession: 'asc' },
      }),
    ]);

    const fightsBySession = new Map<string, typeof fights>();
    for (const fight of fights) {
      if (!fight.sessionId) continue;
      const bucket = fightsBySession.get(fight.sessionId) ?? [];
      bucket.push(fight);
      fightsBySession.set(fight.sessionId, bucket);
    }

    return sessions.map((session) => ({
      ...session,
      fights: (fightsBySession.get(session.id) ?? []).sort(
        (a, b) => (a.orderInSession ?? 0) - (b.orderInSession ?? 0),
      ),
    }));
  }

  private checkGapViolations(
    fights: Array<{ id: string; redAthleteId: string | null; blueAthleteId: string | null }>,
  ): string[] {
    const lastIndexByAthlete = new Map<string, number>();
    const violatedFightIds = new Set<string>();
    for (let i = 0; i < fights.length; i++) {
      const fight = fights[i];
      for (const athleteId of [fight.redAthleteId, fight.blueAthleteId]) {
        if (!athleteId) continue;
        const last = lastIndexByAthlete.get(athleteId);
        if (last != null && i - last - 1 < 10) {
          violatedFightIds.add(fight.id);
        }
        lastIndexByAthlete.set(athleteId, i);
      }
    }
    return [...violatedFightIds];
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
