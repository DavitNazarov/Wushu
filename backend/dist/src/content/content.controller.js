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
exports.ContentController = void 0;
const common_1 = require("@nestjs/common");
const content_service_1 = require("./content.service");
const auth_guard_1 = require("../auth/auth.guard");
const capability_guard_1 = require("../auth/capability.guard");
const capability_decorator_1 = require("../auth/capability.decorator");
const capabilities_1 = require("../auth/capabilities");
const common_2 = require("@nestjs/common");
let ContentController = class ContentController {
    content;
    constructor(content) {
        this.content = content;
    }
    async listNews(req) {
        const auth = req.auth;
        return this.content.listNews(auth.organisationId);
    }
    async upsertNews(req, body) {
        const auth = req.auth;
        return this.content.upsertNews({
            organisationId: auth.organisationId,
            actorUserId: auth.sub,
            id: body.id,
            title: body.title,
            slug: body.slug,
            body: body.body,
            published: body.published,
        });
    }
};
exports.ContentController = ContentController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "listNews", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "upsertNews", null);
exports.ContentController = ContentController = __decorate([
    (0, common_1.Controller)('admin/news'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, capability_guard_1.CapabilityGuard),
    (0, capability_decorator_1.RequireCapability)(capabilities_1.CAPABILITIES.EVENTS_MANAGE),
    __metadata("design:paramtypes", [content_service_1.ContentService])
], ContentController);
//# sourceMappingURL=content.controller.js.map