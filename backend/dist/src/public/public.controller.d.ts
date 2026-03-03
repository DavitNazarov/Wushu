import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
export declare class PublicController {
    private readonly prisma;
    private readonly events;
    constructor(prisma: PrismaService, events: EventsService);
    listPublishedEvents(): Promise<{
        organisationId: string;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        slug: string;
        startDate: Date | null;
        endDate: Date | null;
        location: string | null;
        lifecycle: import("@prisma/client").$Enums.EventLifecycle;
    }[]>;
    getPublishedEvent(id: string): Promise<{
        organisationId: string;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        slug: string;
        startDate: Date | null;
        endDate: Date | null;
        location: string | null;
        lifecycle: import("@prisma/client").$Enums.EventLifecycle;
    }>;
    listPublishedNews(): Promise<{
        organisationId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        title: string;
        body: string;
        publishedAt: Date | null;
    }[]>;
}
