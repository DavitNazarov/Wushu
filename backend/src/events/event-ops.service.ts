import type { Event, EventLifecycle, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  getNextLifecycle,
  isForwardLifecycleTransition,
  isBackwardLifecycleTransition,
} from './lifecycle-rules';
import { getRegistrationStatus } from './event-dates.helper';

/** Handles admin write-ops and summary reads for events (split from EventsService for size). */
@Injectable()
export class EventOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Compute the dashboard summary shown on the event overview page:
  // total registrations, registrations grouped by status (PENDING/APPROVED/...),
  // unique athletes count, unique clubs count. Runs the count + groupBy in
  // parallel; the unique counts are done in JS over a separate findMany rather
  // than two distinct counts (single round-trip).
  async getEventSummary(
    eventId: string,
    organisationId: string,
  ): Promise<{
    totalRegistrations: number;
    byStatus: Record<string, number>;
    totalAthletes: number;
    totalClubs: number;
  }> {
    const [registrations, byStatusRaw] = await Promise.all([
      this.prisma.registration.count({ where: { eventId, organisationId } }),
      this.prisma.registration.groupBy({
        by: ['status'],
        where: { eventId, organisationId },
        _count: { _all: true },
      }),
    ]);

    const athletes = await this.prisma.registration.findMany({
      where: { eventId, organisationId },
      select: { athleteId: true, clubId: true },
    });

    const uniqueAthletes = new Set(athletes.map((r) => r.athleteId)).size;
    const uniqueClubs = new Set(
      athletes.map((r) => r.clubId).filter((id): id is string => id !== null),
    ).size;

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count._all;
    }

    return {
      totalRegistrations: registrations,
      byStatus,
      totalAthletes: uniqueAthletes,
      totalClubs: uniqueClubs,
    };
  }

  // Toggle the public visibility flag. Special case: when an event is in the
  // DRAWN lifecycle state and gets published, we also bump it to PUBLISHED
  // (and vice versa when un-publishing) — so admins don't have to make two
  // separate transitions for the most common case. Returns null when the
  // event doesn't exist in the org. Writes an EVENT_PUBLISHED/UNPUBLISHED audit row.
  async setPublished(
    eventId: string,
    organisationId: string,
    published: boolean,
    actorUserId: string,
  ): Promise<Event | null> {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!existing) return null;

    const lifecycle =
      published && existing.lifecycle === 'DRAWN'
        ? 'PUBLISHED'
        : !published && existing.lifecycle === 'PUBLISHED'
          ? 'DRAWN'
          : existing.lifecycle;

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { published, lifecycle },
    });

    await this.audit.write({
      organisationId,
      eventId,
      actorUserId,
      action: published ? 'EVENT_PUBLISHED' : 'EVENT_UNPUBLISHED',
      entityType: 'event',
      entityId: eventId,
      before: existing as unknown as Prisma.JsonValue,
      after: updated as unknown as Prisma.JsonValue,
    });

    return updated;
  }

  // Toggle public visibility of the confirmed weigh-in weights list, surfaced
  // at /events/:slug/weights. Independent of the general `published` flag and
  // the lifecycle state machine — admins control it from the Weigh-In Results
  // page. Returns null when the event isn't found in this org.
  async setWeighInResultsPublic(
    eventId: string,
    organisationId: string,
    isPublic: boolean,
    actorUserId: string,
  ): Promise<Event | null> {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!existing) return null;

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { weighInResultsPublic: isPublic },
    });

    await this.audit.write({
      organisationId,
      eventId,
      actorUserId,
      action: isPublic
        ? 'EVENT_WEIGHIN_RESULTS_PUBLISHED'
        : 'EVENT_WEIGHIN_RESULTS_UNPUBLISHED',
      entityType: 'event',
      entityId: eventId,
      before: existing as unknown as Prisma.JsonValue,
      after: updated as unknown as Prisma.JsonValue,
    });

    return updated;
  }

  // Hard-delete an event and every child row. Performed in a single
  // transaction so a partial failure rolls back cleanly. Order matters:
  //   - AuditLog / NewsPost: detached (nulled), not deleted, to preserve history
  //   - TimerState rows hang off Fight, so they go first
  //   - Then Fight, ScheduleSession, Bracket, Mat, WeighInAttempt, Registration
  //   - Finally the snapshot row and the Event itself
  // Throws EVENT_NOT_FOUND when nothing matches.
  async deleteEvent(
    eventId: string,
    organisationId: string,
    actorUserId: string,
  ): Promise<void> {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    await this.prisma.$transaction(
      async (tx) => {
        await tx.auditLog.updateMany({
          where: { eventId },
          data: { eventId: null },
        });
        await tx.newsPost.updateMany({
          where: { eventId },
          data: { eventId: null },
        });
        await tx.timerState.deleteMany({ where: { fight: { eventId } } });
        await tx.fight.deleteMany({ where: { eventId } });
        await tx.scheduleSession.deleteMany({ where: { eventId } });
        await tx.bracket.deleteMany({ where: { eventId } });
        await tx.mat.deleteMany({ where: { eventId } });
        await tx.weighInAttempt.deleteMany({ where: { eventId } });
        await tx.registration.deleteMany({ where: { eventId } });
        await tx.eventCategoryTemplateSnapshot.deleteMany({
          where: { eventId },
        });

        await this.audit.write(
          {
            organisationId,
            actorUserId,
            action: 'EVENT_DELETED',
            entityType: 'event',
            entityId: eventId,
            before: existing as unknown as Prisma.JsonValue,
            after: null,
          },
          tx,
        );

        await tx.event.delete({ where: { id: eventId } });
        // Large events delete thousands of child rows — Prisma's default 5s
        // interactive-transaction timeout is too tight (same value as the draw).
      },
      { timeout: 30000 },
    );
  }

  // Move an event between lifecycle states. Enforces three layers of rules:
  //   1. Direction sanity: must be a defined forward OR backward transition.
  //   2. Override gating: backward moves AND forward-skip moves both require
  //      allowOverride=true + a non-empty reason (audit accountability).
  //   3. Domain guards:
  //        REG_OPEN → LOCKED is rejected if the registration window is still open
  //        ? → LIVE is rejected before competitionStartDate
  //      Both can be bypassed via allowOverride.
  // Backward moves additionally set autoAdvanceStage=false so the cron doesn't
  // immediately push the event forward again. Writes an audit row capturing
  // the override flag and reason.
  async transitionLifecycle(input: {
    eventId: string;
    organisationId: string;
    actorUserId: string;
    targetState: EventLifecycle;
    reason?: string | null;
    allowOverride?: boolean;
  }): Promise<Event> {
    const existing = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    const expectedNext = getNextLifecycle(existing.lifecycle);
    const isDirect = expectedNext === input.targetState;
    const now = new Date();
    const isForward = isForwardLifecycleTransition(
      existing.lifecycle,
      input.targetState,
    );
    const isBackward = isBackwardLifecycleTransition(
      existing.lifecycle,
      input.targetState,
    );

    if (!isForward && !isBackward) {
      throw new Error('INVALID_EVENT_TRANSITION');
    }

    // Backward transitions always require explicit override + reason
    if (isBackward) {
      if (!input.allowOverride) throw new Error('INVALID_EVENT_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    // Non-direct forward transitions (skipping stages) also require override + reason
    if (isForward && !isDirect) {
      if (!input.allowOverride) throw new Error('INVALID_EVENT_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    if (
      existing.lifecycle === 'REG_OPEN' &&
      input.targetState === 'LOCKED' &&
      !input.allowOverride &&
      getRegistrationStatus(existing, now) !== 'CLOSED'
    ) {
      throw new Error('REGISTRATION_STILL_OPEN');
    }

    if (input.targetState === 'LIVE' && !input.allowOverride) {
      if (now < existing.competitionStartDate)
        throw new Error('COMPETITION_NOT_STARTED');
    }

    return this.prisma.$transaction(async (tx) => {
      // Compare-and-swap on the lifecycle we validated against: if another
      // admin (or the auto-advance cron) moved the event between our read and
      // this write, the guards above ran against a stale state — abort instead
      // of blindly overwriting (mapped to 409 in the controller).
      const updated = await tx.event.updateMany({
        where: { id: input.eventId, lifecycle: existing.lifecycle },
        data: {
          lifecycle: input.targetState,
          ...(isBackward ? { autoAdvanceStage: false } : {}),
        },
      });
      if (updated.count === 0) {
        throw new Error('EVENT_LIFECYCLE_CONFLICT');
      }
      const result = await tx.event.findUniqueOrThrow({
        where: { id: input.eventId },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: result.id,
        actorUserId: input.actorUserId,
        action: isBackward
          ? 'EVENT_LIFECYCLE_OVERRIDE'
          : isDirect
            ? 'EVENT_LIFECYCLE_TRANSITION'
            : 'EVENT_LIFECYCLE_OVERRIDE',
        entityType: 'event',
        entityId: result.id,
        before: existing as unknown as Prisma.JsonValue,
        after: result as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: !isDirect,
        ipAddress: null,
      });

      return result;
    });
  }
}
