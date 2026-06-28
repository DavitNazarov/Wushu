import { Injectable } from '@nestjs/common';
import type { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { canManageSchedule, isEventReadOnly } from '../events/lifecycle-rules';
import {
  computeLiveStatuses,
  type LiveFightStatus,
} from '../fights/live-queue.logic';
import { buildScheduleRows } from './schedule-order.logic';
import { planAutoScheduleOrder } from './auto-schedule-order.logic';
import {
  buildFightCandidates,
  compareFightCandidate,
} from './schedule-fight-candidates.logic';
import { isFightPlayable } from '../competition/fight-visibility';

// Schedule service: mats, sessions, fight ordering, and the auto-scheduler.
// Big surface area because the running order is the day-of operational core.
// Methods loosely group as:
//   guards + utilities (top)
//   CRUD: mats, sessions
//   reads: getSchedule, getEventSchedule
//   writes: autoSchedule, moveFight, generateSchedule, moveFightToSession,
//           reorderSessions, updateFightOrder
//   internal: rest-window violation checks at the bottom
@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Shared write-guard: refuse to mutate the schedule unless the event is
  // in a lifecycle that allows it AND, if the override flag is set, a reason
  // is supplied. EVENT_READ_ONLY beats EVENT_NOT_READY_FOR_SCHEDULE in the
  // check order so admins get the more-specific error first.
  //
  // A COMPLETED event is terminal: EVENT_READ_ONLY is NOT override-waivable —
  // override only relaxes the "not yet ready" / rest-policy cases below, never
  // re-opens a finished event for schedule edits.
  private assertScheduleMutable(input: {
    event: Event;
    override?: boolean;
    reason?: string | null;
  }): void {
    if (isEventReadOnly(input.event.lifecycle)) {
      throw new Error('EVENT_READ_ONLY');
    }

    if (!canManageSchedule(input.event.lifecycle) && !input.override) {
      throw new Error('EVENT_NOT_READY_FOR_SCHEDULE');
    }

    if (input.override && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }
  }

  // Build the display string for a participant in the schedule view:
  //   - real athlete                          → "FirstName LastName"
  //   - placeholder (winner of an upstream)   → "Winner of N" using order
  //   - everything else                       → "TBD"
  // The KA-localized variant is exposed via a parallel redDisplayNameKa field
  // computed in getSchedule below.
  private displayName(input: {
    athlete: {
      firstName: string;
      lastName: string;
      firstNameKa?: string | null;
      lastNameKa?: string | null;
    } | null;
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

  // Convert a numeric round into the human round label shown in schedule
  // tooltips / detail panels. Final / Semifinal / Quarterfinal / Round of 16
  // are the standard names; anything earlier falls back to "Round N".
  private bracketRoundLabel(round: number, maxRound: number): string {
    const distanceToFinal = maxRound - round;
    if (distanceToFinal <= 0) return 'Final';
    if (distanceToFinal === 1) return 'Semifinal';
    if (distanceToFinal === 2) return 'Quarterfinal';
    if (distanceToFinal === 3) return 'Round of 16';
    return `Round ${round}`;
  }

  // List all mats in an event sorted by their display `order`. Drives the
  // mat tabs UI; index 0 is the leftmost tab.
  async listMats(organisationId: string, eventId: string) {
    return this.prisma.mat.findMany({
      where: { organisationId, eventId },
      orderBy: { order: 'asc' },
    });
  }

  // List time-slot sessions (Morning / Afternoon / etc.) sorted by `order`.
  // Sessions are admin-defined buckets, distinct from physical mats.
  async listSessions(organisationId: string, eventId: string) {
    return this.prisma.scheduleSession.findMany({
      where: { organisationId, eventId },
      orderBy: { order: 'asc' },
    });
  }

  // Create-or-update a scheduling session. Validates that startTime/endTime
  // parse to real dates (INVALID_SESSION_TIMES) and end > start
  // (SESSION_END_BEFORE_START). If input.id is set we update by id (after
  // verifying tenancy); otherwise create a new row.
  async upsertSession(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    id?: string;
    name: string;
    nameKa?: string | null;
    startTime: string;
    endTime: string;
    order: number;
  }) {
    // BF-16: session CRUD must respect the lifecycle like every other schedule
    // mutation — reject on read-only (COMPLETED) / not-yet-schedulable events.
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({ event });

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('INVALID_SESSION_TIMES');
    }
    if (endTime <= startTime) throw new Error('SESSION_END_BEFORE_START');

    if (input.id) {
      const existing = await this.prisma.scheduleSession.findFirst({
        where: {
          id: input.id,
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
      });
      if (!existing) throw new Error('SESSION_NOT_FOUND');
      return this.prisma.scheduleSession.update({
        where: { id: input.id },
        data: { name: input.name, nameKa: input.nameKa ?? null, startTime, endTime, order: input.order },
      });
    }
    return this.prisma.scheduleSession.create({
      data: {
        organisationId: input.organisationId,
        eventId: input.eventId,
        name: input.name,
        nameKa: input.nameKa ?? null,
        startTime,
        endTime,
        order: input.order,
      },
    });
  }

  // Delete a session, detaching any fights pinned to it first
  // (sessionId/orderInSession nulled). Throws SESSION_NOT_FOUND when missing.
  async deleteSession(input: {
    organisationId: string;
    eventId: string;
    sessionId: string;
  }) {
    const existing = await this.prisma.scheduleSession.findFirst({
      where: {
        id: input.sessionId,
        organisationId: input.organisationId,
        eventId: input.eventId,
      },
    });
    if (!existing) throw new Error('SESSION_NOT_FOUND');

    // BF-16: don't allow deleting sessions on a read-only/non-schedulable event.
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({ event });

    // Unlink fights from this session before deleting
    await this.prisma.fight.updateMany({
      where: {
        sessionId: input.sessionId,
        organisationId: input.organisationId,
      },
      data: { sessionId: null, orderInSession: null },
    });

    return this.prisma.scheduleSession.delete({
      where: { id: input.sessionId },
    });
  }

  // Create-or-update a mat row. id present → update with tenant check
  // (MAT_NOT_FOUND on miss); absent → create.
  async upsertMat(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    id?: string;
    name: string;
    order: number;
  }) {
    // BF-16: mat CRUD is a schedule mutation like sessions — reject on a
    // read-only (COMPLETED) or not-yet-schedulable event so the running order
    // can't be edited out of its lifecycle window.
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({ event });

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

  // Build the schedule view: every fight with mat/athlete/category joins,
  // shaped through buildScheduleRows. Used by the admin schedule UI, the
  // public schedule page, and the mat displays (filtered to one mat via matId).
  // Pre-computes redDisplayName/blueDisplayName (+ KA variants) so callers
  // don't have to handle "Winner of X" / "TBD" cases inline.
  async getSchedule(params: {
    organisationId: string;
    eventId: string;
    matId?: string;
  }) {
    const [fights, sessions] = await Promise.all([
      this.prisma.fight.findMany({
        where: {
          organisationId: params.organisationId,
          eventId: params.eventId,
        },
        include: {
          mat: true,
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
        },
        orderBy: [
          { eventWeightCategoryId: 'asc' },
          { categoryCode: 'asc' },
          { round: 'asc' },
          { boutNo: 'asc' },
        ],
      }),
      this.prisma.scheduleSession.findMany({
        where: {
          organisationId: params.organisationId,
          eventId: params.eventId,
        },
        orderBy: { order: 'asc' },
        select: { id: true, order: true },
      }),
    ]);

    const sessionOrderById = new Map(sessions.map((s) => [s.id, s.order]));

    const scheduleRows = buildScheduleRows(fights).map((row) => ({
      ...row,
      liveStatus: 'PENDING' as LiveFightStatus,
    }));

    const liveStatuses = computeLiveStatuses(
      scheduleRows.map((row) => ({
        id: row.id,
        matId: row.matId,
        orderInMat: row.orderInMat,
        sessionOrder: row.sessionId
          ? (sessionOrderById.get(row.sessionId) ?? null)
          : null,
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

  // Time-aware automatic scheduler. Distributes playable fights across mats
  // while respecting per-athlete rest windows and (optionally) session-window
  // boundaries.
  //
  // Inputs:
  //   - startTimeIso : ISO datetime — the wall-clock origin for the schedule.
  //   - avgBoutSeconds + bufferSeconds : per-mat per-bout cost.
  //   - restMinutes  : minimum gap between two fights for the same athlete.
  //                    Falls back to event.minRestMinutes; values below the
  //                    event policy require override OR they error
  //                    REST_CONSTRAINT_VIOLATION.
  //   - seed         : reserved for deterministic tie-breaks (currently unused).
  //   - useSessions  : if true, fights snap to defined session windows;
  //                    when a fight would land in a gap, all mat clocks jump
  //                    forward to the next session's start.
  //
  // Algorithm per fight (greedy):
  //   1. earliestStart = max(matReady[m], athleteReady[a]+rest) per mat;
  //      pick the mat that minimizes earliestStart.
  //   2. If sessions are enabled, advance mat clocks past any current
  //      session's end into the next session's start, then re-pick.
  //   3. Push fight at (bestMat, nextOrderInMat, earliestStart), update both
  //      mat-clock + per-athlete clock.
  // Finally writes all schedule changes in one transaction.
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
    const { fights: schedulableFights, diagnostics } =
      planAutoScheduleOrder(fights);
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
          where: {
            organisationId: input.organisationId,
            eventId: input.eventId,
          },
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
          ...athleteIds.map(
            (id) => (athleteLastFightEndTime.get(id) ?? 0) + restMs,
          ),
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
                    ...athleteIds.map(
                      (id) => (athleteLastFightEndTime.get(id) ?? 0) + restMs,
                    ),
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
      for (const id of athleteIds)
        athleteLastFightEndTime.set(id, fightEndTime);

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

  // Manually relocate a fight to a new (mat, orderInMat) slot. Guards:
  //   FIGHT_NOT_FOUND       — fight missing or wrong org.
  //   FIGHT_NOT_SCHEDULABLE — fight isn't playable (BYE / already won / etc.).
  //   EVENT_NOT_READY_FOR_SCHEDULE / EVENT_READ_ONLY / OVERRIDE_REASON_REQUIRED.
  //   MAT_NOT_FOUND        — target mat missing or wrong event.
  //   REST_CONSTRAINT_VIOLATION — moving here would put two of the same
  //     athlete's fights within minRestMinutes (unless override).
  // Inside the transaction: re-pack orderInMat for both target and source
  // mats so there are no holes, then write an audit row.
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
      !isFightPlayable({
        redAthleteId: fight.redAthleteId,
        blueAthleteId: fight.blueAthleteId,
        winnerAthleteId: fight.winnerAthleteId,
        status: fight.status,
      })
    ) {
      throw new Error('FIGHT_NOT_SCHEDULABLE');
    }
    // BF-17: isFightPlayable still treats IN_PROGRESS/PAUSED as playable, but a
    // bout that's actively being contested must not be relocated unless an admin
    // explicitly overrides.
    if (
      (fight.status === 'IN_PROGRESS' || fight.status === 'PAUSED') &&
      !input.override
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

      const insertAt = Math.max(
        0,
        Math.min(targetFights.length, input.toOrder - 1),
      );
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
  // Quick non-time-aware variant: takes all schedulable fights and packs them
  // into sessions by capacity ((sessionDurationSeconds) / (avgBout+buffer)),
  // assigning orderInSession but NOT scheduledStartTime. Useful for the
  // initial "split the day into chunks" step before running autoSchedule.
  // Errors:
  //   NO_SESSIONS / NO_SCHEDULABLE_FIGHTS                                → 400
  //   EVENT_NOT_FOUND                                                    → 404
  //   EVENT_NOT_READY_FOR_SCHEDULE / EVENT_READ_ONLY / OVERRIDE_REASON_REQUIRED
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
    this.assertScheduleMutable({
      event,
      override: input.override,
      reason: input.reason ?? null,
    });

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

    // Incremental: only place fights that aren't in a session yet — real bouts
    // AND "Winner of N" placeholders — in canonical bracket order (the same
    // order buildScheduleRows / the schedule PDF use). Already-scheduled fights
    // are left exactly where they are (preserving any manual drag arrangement);
    // generating again only appends the still-unassigned ones. Rest-gap
    // proximity is surfaced as an on-page warning, not enforced here.
    const orderedFights = buildFightCandidates(fights)
      .sort(compareFightCandidate)
      .map((candidate) => candidate.fight)
      .filter(
        (f) =>
          (f.status === 'QUEUED' || f.status === 'ON_DECK') &&
          f.winnerAthleteId == null &&
          (f.sessionId == null || f.orderInSession == null),
      );
    if (orderedFights.length === 0) throw new Error('NO_SCHEDULABLE_FIGHTS');

    // Rest-gap diagnostics are no longer computed server-side: the admin
    // schedule page flags too-close bouts inline against the live ordering.
    const diagnostics = {
      minFightGap: 0,
      fullySatisfied: true,
      conflictCount: 0,
      conflicts: [] as never[],
    };

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
    const assignments: SessionAssignment[] = sessionList.map((s) => ({
      sessionId: s.id,
      fights: [],
    }));

    // Every fight already placed in a session is retained as-is — we never move
    // or renumber it. Its slot stays occupied, so appended fights consume the
    // remaining capacity and start numbering AFTER the highest slot in use.
    const retainedMaxOrderBySession = new Map<string, number>();
    const retainedCountBySession = new Map<string, number>();
    for (const f of fights) {
      if (f.sessionId == null || f.orderInSession == null) continue;
      retainedCountBySession.set(
        f.sessionId,
        (retainedCountBySession.get(f.sessionId) ?? 0) + 1,
      );
      retainedMaxOrderBySession.set(
        f.sessionId,
        Math.max(
          retainedMaxOrderBySession.get(f.sessionId) ?? 0,
          f.orderInSession,
        ),
      );
    }

    let sessionIdx = 0;
    for (const fight of orderedFights) {
      // Find a session with remaining capacity (capacity already taken by
      // retained, still-placed fights is subtracted).
      while (sessionIdx < assignments.length) {
        const retained =
          retainedCountBySession.get(assignments[sessionIdx].sessionId) ?? 0;
        const cap = sessionCapacity(sessionList[sessionIdx]) - retained;
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

    // Apply only the new placements — no clear step, so already-scheduled
    // fights keep their session + orderInSession untouched.
    const writes: Prisma.PrismaPromise<unknown>[] = [];
    for (const assignment of assignments) {
      // Start numbering after the slots retained (still-placed) fights occupy.
      const offset = retainedMaxOrderBySession.get(assignment.sessionId) ?? 0;
      for (let i = 0; i < assignment.fights.length; i++) {
        writes.push(
          this.prisma.fight.update({
            where: { id: assignment.fights[i] },
            data: {
              sessionId: assignment.sessionId,
              orderInSession: offset + i + 1,
            },
          }),
        );
      }
    }
    writes.push(
      this.prisma.auditLog.create({
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
      }),
    );
    await this.prisma.$transaction(writes);

    return {
      sessionCount: assignments.length,
      fightCount: orderedFights.length,
      diagnostics,
    };
  }

  /**
   * Move a fight to a different position within a session or to another session.
   * insertAfterOrder: 0 = prepend, N = insert after Nth fight.
   * Returns gap violations (fightIds of athletes with < 10-fight gap).
   */
  // Same overall shape as moveFight but for the session axis instead of the
  // mat axis: changes (sessionId, orderInSession). Passing toSessionId=null
  // detaches the fight from any session. Source + target sessions get re-packed
  // so there are no holes. After committing, computes a gapViolations array
  // (athletes whose two fights ended up too close together) for UI banners.
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
    this.assertScheduleMutable({
      event: fight.event,
      override: input.override,
      reason: input.reason ?? null,
    });

    // BF-17: a contested or finished fight must not be moved between sessions
    // (corrupts the live running order / re-shuffles a decided bout).
    if (
      ['IN_PROGRESS', 'PAUSED', 'COMPLETE', 'CONFIRMED'].includes(
        fight.status,
      ) &&
      !input.override
    ) {
      throw new Error('FIGHT_NOT_SCHEDULABLE');
    }

    // SEC-2 (IDOR): the destination session must belong to the SAME org+event as
    // the fight. Without this, a fight could be attached to a foreign org/event
    // session and that session's fight order repacked.
    if (input.toSessionId) {
      const targetSession = await this.prisma.scheduleSession.findFirst({
        where: {
          id: input.toSessionId,
          organisationId: input.organisationId,
          eventId: fight.eventId,
        },
        select: { id: true },
      });
      if (!targetSession) throw new Error('SESSION_NOT_FOUND');
    }

    const fromSessionId = fight.sessionId;

    // Fetch source, target, and all-event fights in parallel. All fight reads
    // are tenant+event scoped so a session-id collision can't pull foreign rows.
    const [sourceFights, targetFights, allSessionFights] = await Promise.all([
      fromSessionId
        ? this.prisma.fight.findMany({
            where: {
              sessionId: fromSessionId,
              organisationId: input.organisationId,
              eventId: fight.eventId,
              id: { not: input.fightId },
            },
            orderBy: { orderInSession: 'asc' },
            select: {
              id: true,
              orderInSession: true,
              redAthleteId: true,
              blueAthleteId: true,
            },
          })
        : Promise.resolve([]),
      input.toSessionId
        ? this.prisma.fight.findMany({
            where: {
              sessionId: input.toSessionId,
              organisationId: input.organisationId,
              eventId: fight.eventId,
              id:
                fromSessionId === input.toSessionId
                  ? { not: input.fightId }
                  : undefined,
            },
            orderBy: { orderInSession: 'asc' },
            select: {
              id: true,
              orderInSession: true,
              redAthleteId: true,
              blueAthleteId: true,
            },
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
        orderBy: [
          { scheduleSession: { order: 'asc' } },
          { orderInSession: 'asc' },
        ],
      }),
    ]);

    // Build all DB writes upfront, then execute in a single transaction batch
    const writes: Prisma.PrismaPromise<unknown>[] = [];

    // Repack source session — only update fights whose position actually changed
    for (let i = 0; i < sourceFights.length; i++) {
      const newOrder = i + 1;
      if (sourceFights[i].orderInSession !== newOrder) {
        writes.push(
          this.prisma.fight.update({
            where: { id: sourceFights[i].id },
            data: { orderInSession: newOrder },
          }),
        );
      }
    }

    if (input.toSessionId === null) {
      // Unassign
      writes.push(
        this.prisma.fight.update({
          where: { id: input.fightId },
          data: { sessionId: null, orderInSession: null },
        }),
      );
    } else {
      // Insert into target session
      const insertAt = Math.max(
        0,
        Math.min(targetFights.length, input.insertAfterOrder),
      );
      const ids = targetFights.map((f) => f.id);
      ids.splice(insertAt, 0, input.fightId);
      for (let i = 0; i < ids.length; i++) {
        writes.push(
          this.prisma.fight.update({
            where: { id: ids[i] },
            data: { sessionId: input.toSessionId, orderInSession: i + 1 },
          }),
        );
      }
    }

    // Audit write
    writes.push(
      this.prisma.auditLog.create({
        data: {
          organisationId: input.organisationId,
          eventId: fight.eventId,
          actorUserId: input.actorUserId,
          action: 'FIGHT_MOVED',
          entityType: 'fight',
          entityId: input.fightId,
          before: {
            sessionId: fromSessionId,
            orderInSession: fight.orderInSession,
          } as Prisma.InputJsonValue,
          after: {
            sessionId: input.toSessionId,
            insertAfterOrder: input.insertAfterOrder,
          } as Prisma.InputJsonValue,
          override: input.override ?? false,
          reason: input.reason ?? null,
        },
      }),
    );

    await this.prisma.$transaction(writes);

    const gapViolations = this.checkGapViolations(allSessionFights);
    return { ok: true, eventId: fight.eventId, gapViolations };
  }

  /**
   * Bulk-reorder sessions by providing session IDs in new order.
   */
  // Re-numbers `order` on every session in input.sessionIds so the first
  // entry becomes order=1, second becomes 2, etc.
  async reorderSessions(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    sessionIds: string[];
  }) {
    // BF-16: reordering is a schedule mutation — reject on read-only events.
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    this.assertScheduleMutable({ event });

    // SEC-1: every session id MUST belong to this org+event before we touch it.
    // The controller does NOT pre-validate the id set, so without this guard a
    // SCHEDULE_MANAGE admin could rewrite another org's session ordering with
    // guessed/leaked CUIDs (cross-tenant IDOR). Reject the whole batch if any
    // id is foreign, then write with a tenant-scoped updateMany.
    const uniqueIds = [...new Set(input.sessionIds)];
    if (uniqueIds.length > 0) {
      const owned = await this.prisma.scheduleSession.findMany({
        where: {
          id: { in: uniqueIds },
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
        select: { id: true },
      });
      if (owned.length !== uniqueIds.length) {
        throw new Error('SESSION_NOT_FOUND');
      }
    }
    await this.prisma.$transaction(
      input.sessionIds.map((id, idx) =>
        this.prisma.scheduleSession.updateMany({
          where: {
            id,
            organisationId: input.organisationId,
            eventId: input.eventId,
          },
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
      after: {
        reorderedSessions: input.sessionIds,
      } as unknown as Prisma.JsonValue,
      override: false,
      reason: null,
    });
  }

  /**
   * Bulk-reorder fights within a session.
   * orderedFightIds must contain all fight IDs currently in the session.
   * Recalculates orderInSession as sequential 1,2,3...
   */
  // Strict input contract: orderedFightIds must equal the session's current
  // fight set (no adds, no drops). Otherwise → FIGHT_IDS_MISMATCH.
  // SESSION_NOT_FOUND / EVENT_NOT_FOUND surface as 404s in the controller.
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
    if (
      currentIds.size !== inputIds.size ||
      ![...currentIds].every((id) => inputIds.has(id))
    ) {
      throw new Error('FIGHT_IDS_MISMATCH');
    }

    const writes: Prisma.PrismaPromise<unknown>[] = input.orderedFightIds.map(
      (id, i) =>
        this.prisma.fight.update({
          where: { id },
          data: { orderInSession: i + 1 },
        }),
    );
    writes.push(
      this.prisma.auditLog.create({
        data: {
          organisationId: input.organisationId,
          eventId: session.eventId,
          actorUserId: input.actorUserId,
          action: 'FIGHT_ORDER_UPDATED',
          entityType: 'scheduleSession',
          entityId: input.sessionId,
          after: {
            orderedFightIds: input.orderedFightIds,
          } as Prisma.InputJsonValue,
          override: false,
          reason: null,
        },
      }),
    );
    await this.prisma.$transaction(writes);

    return { ok: true, eventId: session.eventId };
  }

  /**
   * Returns sessions with their ordered fights for an event.
   * This is the authoritative schedule view.
   */
  // Composite endpoint backing GET /api/schedule/event — returns the sessions
  // array with each session's fights pre-grouped + sorted by orderInSession.
  // Joins athlete + category metadata so the UI doesn't need a second pass.
  async getEventSchedule(params: { organisationId: string; eventId: string }) {
    const [sessions, fights] = await Promise.all([
      this.prisma.scheduleSession.findMany({
        where: {
          organisationId: params.organisationId,
          eventId: params.eventId,
        },
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
          blueAthlete: {
            select: { id: true, firstName: true, lastName: true },
          },
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

  // Slot-distance gap check (no time math). For every fight in event order,
  // if any of its athletes also appeared within the previous 10 fight slots,
  // flag this fight as a violation. Used to enforce the "at least 10 fights
  // between consecutive bouts for the same athlete" festival rule.
  private checkGapViolations(
    fights: Array<{
      id: string;
      redAthleteId: string | null;
      blueAthleteId: string | null;
    }>,
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

  // Time-aware rest check for moveFight. Compares the candidate move's
  // scheduledStartTime against the immediate neighbours on the target mat
  // (orderInMat-1 and orderInMat). Returns true if any neighbour shares an
  // athlete with the moving fight AND the gap is below minRestMinutes.
  // Treats missing scheduledStartTime as worst-case (true) so we don't
  // silently accept unschedulable inputs.
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
      const neighbourAthletes = [
        neighbour.redAthleteId,
        neighbour.blueAthleteId,
      ].filter(Boolean) as string[];
      if (neighbourAthletes.some((id) => movingAthletes.includes(id))) {
        if (!neighbour.scheduledStartTime || !moving.scheduledStartTime)
          return true;
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
