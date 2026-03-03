"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/audit.service");
let RulesetsService = class RulesetsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(organisationId) {
        return this.prisma.ruleset.findMany({
            where: { organisationId: organisationId ?? undefined },
            orderBy: [{ organisationId: 'asc' }, { name: 'asc' }, { version: 'desc' }],
        });
    }
    async create(input) {
        const last = await this.prisma.ruleset.findFirst({
            where: { organisationId: input.organisationId ?? undefined, name: input.name },
            orderBy: { version: 'desc' },
        });
        const nextVersion = (last?.version ?? 0) + 1;
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.ruleset.create({
                data: {
                    organisationId: input.organisationId ?? undefined,
                    name: input.name,
                    version: nextVersion,
                    status: input.status ?? 'DRAFT',
                    definition: input.definition,
                },
            });
            await this.audit.write({
                organisationId: input.organisationId ?? '',
                actorUserId: input.actorUserId ?? null,
                action: 'RULESET_CREATED',
                entityType: 'ruleset',
                entityId: created.id,
                before: null,
                after: created,
            });
            return created;
        });
    }
};
exports.RulesetsService = RulesetsService;
exports.RulesetsService = RulesetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RulesetsService);
//# sourceMappingURL=rulesets.service.js.map