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
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/audit.service");
const allowedTransitions = {
    REG_OPEN: ['WEIGHIN'],
    WEIGHIN: ['LOCKED'],
    LOCKED: ['DRAWN'],
    DRAWN: ['PUBLISHED'],
    PUBLISHED: ['LIVE'],
    LIVE: ['COMPLETED'],
    COMPLETED: [],
};
const PUBLISHED_STATES = ['PUBLISHED', 'LIVE', 'COMPLETED'];
let EventsService = class EventsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getById(eventId, organisationId) {
        return this.prisma.event.findFirst({
            where: { id: eventId, organisationId },
        });
    }
    async list(organisationId) {
        return this.prisma.event.findMany({
            where: { organisationId },
            orderBy: { startDate: 'desc' },
        });
    }
    async listPublished() {
        return this.prisma.event.findMany({
            where: { lifecycle: { in: PUBLISHED_STATES } },
            orderBy: { startDate: 'desc' },
        });
    }
    async getPublishedById(id) {
        return this.prisma.event.findFirst({
            where: {
                id,
                lifecycle: { in: PUBLISHED_STATES },
            },
        });
    }
    async create(input) {
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
                after: event,
                reason: null,
                ipAddress: null,
            });
            return event;
        });
    }
    async transitionLifecycle(input) {
        const existing = await this.getById(input.eventId, input.organisationId);
        if (!existing)
            throw new Error('EVENT_NOT_FOUND');
        const allowed = allowedTransitions[existing.lifecycle] ?? [];
        const isDirect = allowed.includes(input.targetState);
        if (!isDirect) {
            if (!input.allowOverride)
                throw new Error('INVALID_EVENT_TRANSITION');
            if (!input.reason)
                throw new Error('OVERRIDE_REASON_REQUIRED');
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
                before: existing,
                after: result,
                reason: input.reason ?? null,
                ipAddress: null,
            });
            return result;
        });
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EventsService);
//# sourceMappingURL=events.service.js.map