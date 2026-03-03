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
exports.RulesetsController = void 0;
const common_1 = require("@nestjs/common");
const rulesets_service_1 = require("./rulesets.service");
const auth_guard_1 = require("../auth/auth.guard");
const capability_guard_1 = require("../auth/capability.guard");
const capability_decorator_1 = require("../auth/capability.decorator");
const capabilities_1 = require("../auth/capabilities");
const common_2 = require("@nestjs/common");
let RulesetsController = class RulesetsController {
    rulesets;
    constructor(rulesets) {
        this.rulesets = rulesets;
    }
    async list(req) {
        const auth = req.auth;
        return this.rulesets.list(auth.organisationId);
    }
    async create(req, body) {
        const auth = req.auth;
        return this.rulesets.create({
            organisationId: auth.organisationId,
            name: body.name,
            definition: body.definition,
            actorUserId: auth.sub,
        });
    }
};
exports.RulesetsController = RulesetsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RulesetsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RulesetsController.prototype, "create", null);
exports.RulesetsController = RulesetsController = __decorate([
    (0, common_1.Controller)('rulesets'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, capability_guard_1.CapabilityGuard),
    (0, capability_decorator_1.RequireCapability)(capabilities_1.CAPABILITIES.CAN_MANAGE_RULESETS),
    __metadata("design:paramtypes", [rulesets_service_1.RulesetsService])
], RulesetsController);
//# sourceMappingURL=rulesets.controller.js.map