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

  async deleteEvent(
    eventId: string,
    organisationId: string,
    actorUserId: string,
  ): Promise<void> {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    await this.prisma.$transaction(async (tx) => {
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
      await tx.eventCategoryTemplateSnapshot.deleteMany({ where: { eventId } });

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
    });
  }

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
      // When moving backward via override, disable auto-advance so automation
      // doesn't immediately re-advance the event back to where it was.
      const result = await tx.event.update({
        where: { id: input.eventId },
        data: {
          lifecycle: input.targetState,
          ...(isBackward ? { autoAdvanceStage: false } : {}),
        },
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
