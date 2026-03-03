import { EventsService } from './events.service';
import { type AuthenticatedRequest } from '../auth/auth.guard';
export declare class EventsController {
    private readonly events;
    constructor(events: EventsService);
    list(req: AuthenticatedRequest): Promise<{
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
    create(req: AuthenticatedRequest, body: any): Promise<{
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
    transitionLifecycle(id: string, req: AuthenticatedRequest, body: {
        targetState: string;
        reason?: string;
        override?: boolean;
    }): Promise<{
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
}
