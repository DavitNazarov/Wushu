import type { Prisma, RulesetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
export declare class RulesetsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(organisationId: string | null): Promise<{
        organisationId: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        version: number;
        status: import("@prisma/client").$Enums.RulesetStatus;
        definition: Prisma.JsonValue;
    }[]>;
    create(input: {
        organisationId: string | null;
        name: string;
        definition: unknown;
        status?: RulesetStatus;
        actorUserId?: string | null;
    }): Promise<{
        organisationId: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        version: number;
        status: import("@prisma/client").$Enums.RulesetStatus;
        definition: Prisma.JsonValue;
    }>;
}
