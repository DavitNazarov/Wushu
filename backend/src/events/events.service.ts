import type { Event, EventLifecycle, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

const allowedTransitions: Record<EventLifecycle, EventLifecycle[]> = {
  REG_OPEN: ['WEIGHIN'],
  WEIGHIN: ['LOCKED'],
  LOCKED: ['DRAWN'],
  DRAWN: ['PUBLISHED'],
  PUBLISHED: ['LIVE'],
  LIVE: ['COMPLETED'],
  COMPLETED: [],
};

const PUBLISHED_STATES: EventLifecycle[] = ['PUBLISHED', 'LIVE', 'COMPLETED'];

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getById(eventId: string, organisationId: string): Promise<Event | null> {
    return this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
  }

  async list(organisationId: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { organisationId },
      orderBy: { startDate: 'desc' },
    });
  }

  async listPublished(): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { lifecycle: { in: PUBLISHED_STATES } },
      orderBy: { startDate: 'desc' },
    });
  }

  async getPublishedById(id: string): Promise<Event | null> {
    return this.prisma.event.findFirst({
      where: {
        id,
        lifecycle: { in: PUBLISHED_STATES },
      },
    });
  }

  async create(input: {
    organisationId: string;
    actorUserId: string;
    name: string;
    slug: string;
    startDate?: Date | null;
    endDate?: Date | null;
    location?: string | null;
  }): Promise<Event> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organisation: { connect: { id: input.organisationId } },
          name: input.name,
          slug: input.slug,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          location: input.location ?? null,
        },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: event.id,
        actorUserId: input.actorUserId,
        action: 'EVENT_CREATED',
        entityType: 'event',
        entityId: event.id,
        before: null,
        after: event as unknown as Prisma.JsonValue,
        reason: null,
        ipAddress: null,
      });

      return event;
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
    const existing = await this.getById(input.eventId, input.organisationId);
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    const allowed = allowedTransitions[existing.lifecycle] ?? [];
    const isDirect = allowed.includes(input.targetState);

    if (!isDirect) {
      if (!input.allowOverride) throw new Error('INVALID_EVENT_TRANSITION');
      if (!input.reason) throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.event.update({
        where: { id: input.eventId },
        data: { lifecycle: input.targetState },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: result.id,
        actorUserId: input.actorUserId,
        action: isDirect ? 'EVENT_LIFECYCLE_TRANSITION' : 'EVENT_LIFECYCLE_OVERRIDE',
        entityType: 'event',
        entityId: result.id,
        before: existing as unknown as Prisma.JsonValue,
        after: result as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        ipAddress: null,
      });

      return result;
    });
  }
}
