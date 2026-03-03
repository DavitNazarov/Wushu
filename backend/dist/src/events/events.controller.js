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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsController = void 0;
const common_1 = require("@nestjs/common");
const events_service_1 = require("./events.service");
const auth_guard_1 = require("../auth/auth.guard");
const capability_guard_1 = require("../auth/capability.guard");
const capability_decorator_1 = require("../auth/capability.decorator");
const capabilities_1 = require("../auth/capabilities");
const common_2 = require("@nestjs/common");
let EventsController = class EventsController {
    events;
    constructor(events) {
        this.events = events;
    }
    async list(req) {
        const auth = req.auth;
        return this.events.list(auth.organisationId);
    }
    async create(req, body) {
        const auth = req.auth;
        try {
            return await this.events.create({
                organisationId: auth.organisationId,
                actorUserId: auth.sub,
                name: body.name,
                slug: body.slug,
                startDate: body.startDate ? new Date(body.startDate) : null,
                endDate: body.endDate ? new Date(body.endDate) : null,
                location: body.location ?? null,
            });
        }
        catch (e) {
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async transitionLifecycle(id, req, body) {
        const auth = req.auth;
        try {
            return await this.events.transitionLifecycle({
                eventId: id,
                organisationId: auth.organisationId,
                actorUserId: auth.sub,
                targetState: body.targetState,
                reason: body.reason ?? null,
                allowOverride: body.override ?? false,
            });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown';
            if (msg === 'EVENT_NOT_FOUND')
                throw new common_1.HttpException(msg, common_1.HttpStatus.NOT_FOUND);
            if (msg === 'INVALID_EVENT_TRANSITION' || msg === 'OVERRIDE_REASON_REQUIRED')
                throw new common_1.HttpException(msg, common_1.HttpStatus.BAD_REQUEST);
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.EventsController = EventsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, capability_guard_1.CapabilityGuard),
    (0, capability_decorator_1.RequireCapability)(capabilities_1.CAPABILITIES.CAN_MANAGE_EVENT),
    __param(0, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, capability_guard_1.CapabilityGuard),
    (0, capability_decorator_1.RequireCapability)(capabilities_1.CAPABILITIES.CAN_MANAGE_EVENT),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/lifecycle'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, capability_guard_1.CapabilityGuard),
    (0, capability_decorator_1.RequireCapability)(capabilities_1.CAPABILITIES.CAN_MANAGE_EVENT),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_2.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "transitionLifecycle", null);
exports.EventsController = EventsController = __decorate([
    (0, common_1.Controller)('events'),
    __metadata("design:paramtypes", [events_service_1.EventsService])
], EventsController);
//# sourceMappingURL=events.controller.js.map