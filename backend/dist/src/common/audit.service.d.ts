import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
type AuditParams = {
    organisationId: string;
    eventId?: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: Prisma.JsonValue | null;
    after?: Prisma.JsonValue | null;
    reason?: string | null;
    ipAddress?: string | null;
};
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    write(params: AuditParams): Promise<void>;
}
export {};
