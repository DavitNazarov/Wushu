import type { Event, EventLifecycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
export declare class EventsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    getById(eventId: string, organisationId: string): Promise<Event | null>;
    list(organisationId: string): Promise<Event[]>;
    listPublished(): Promise<Event[]>;
    getPublishedById(id: string): Promise<Event | null>;
    create(input: {
        organisationId: string;
        actorUserId: string;
        name: string;
        slug: string;
        startDate?: Date | null;
        endDate?: Date | null;
        location?: string | null;
    }): Promise<Event>;
    transitionLifecycle(input: {
        eventId: string;
        organisationId: string;
        actorUserId: string;
        targetState: EventLifecycle;
        reason?: string | null;
        allowOverride?: boolean;
    }): Promise<Event>;
}
