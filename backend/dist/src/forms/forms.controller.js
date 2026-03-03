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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormsController = void 0;
const common_1 = require("@nestjs/common");
const express_1 = __importDefault(require("express"));
const prisma_service_1 = require("../prisma/prisma.service");
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitStore = new Map();
function isRateLimited(key) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const existing = rateLimitStore.get(key) ?? [];
    const recent = existing.filter((ts) => ts >= windowStart);
    if (recent.length >= RATE_LIMIT_MAX) {
        rateLimitStore.set(key, recent);
        return true;
    }
    recent.push(now);
    rateLimitStore.set(key, recent);
    return false;
}
let FormsController = class FormsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async contact(body, req) {
        const ip = req.headers['x-forwarded-for'] ??
            req.ip ??
            'unknown';
        if (isRateLimited(ip)) {
            throw new common_1.HttpException('RATE_LIMITED', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        if (body.website?.trim?.()) {
            return { ok: true };
        }
        if (!body.name || !body.email || !body.message) {
            throw new common_1.HttpException('INVALID_INPUT', common_1.HttpStatus.BAD_REQUEST);
        }
        const org = await this.prisma.organisation.findFirst();
        if (!org) {
            throw new common_1.HttpException('NO_ORGANISATION', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        await this.prisma.contactSubmission.create({
            data: {
                organisationId: org.id,
                type: body.type,
                name: body.name,
                email: body.email,
                message: body.message,
                clubName: body.clubName ?? null,
            },
        });
        return { ok: true };
    }
};
exports.FormsController = FormsController;
__decorate([
    (0, common_1.Post)('contact'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FormsController.prototype, "contact", null);
exports.FormsController = FormsController = __decorate([
    (0, common_1.Controller)('forms'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FormsController);
//# sourceMappingURL=forms.controller.js.map