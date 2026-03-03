import { RulesetsService } from './rulesets.service';
import { type AuthenticatedRequest } from '../auth/auth.guard';
export declare class RulesetsController {
    private readonly rulesets;
    constructor(rulesets: RulesetsService);
    list(req: AuthenticatedRequest): Promise<{
        organisationId: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        version: number;
        status: import("@prisma/client").$Enums.RulesetStatus;
        definition: import("@prisma/client/runtime/client").JsonValue;
    }[]>;
    create(req: AuthenticatedRequest, body: {
        name: string;
        definition: unknown;
    }): Promise<{
        organisationId: string | null;
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        version: number;
        status: import("@prisma/client").$Enums.RulesetStatus;
        definition: import("@prisma/client/runtime/client").JsonValue;
    }>;
}
