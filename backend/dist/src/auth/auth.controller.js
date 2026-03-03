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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("./auth.service");
const auth_guard_1 = require("./auth.guard");
const capability_guard_1 = require("./capability.guard");
const capability_decorator_1 = require("./capability.decorator");
const capabilities_1 = require("./capabilities");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    me(req) {
        const token = req.cookies?.[auth_service_1.JWT_COOKIE_NAME] ?? req.headers.authorization?.replace('Bearer ', '');
        if (!token)
            return { userId: null, organisationId: null, role: null, capabilities: [] };
        const payload = this.auth.verifyToken(token);
        if (!payload)
            return { userId: null, organisationId: null, role: null, capabilities: [] };
        return {
            userId: payload.sub,
            organisationId: payload.organisationId,
            role: payload.role,
            capabilities: payload.capabilities,
        };
    }
    async login(body, res, req) {
        const ipAddress = req.headers['x-forwarded-for'] ?? req.ip ?? null;
        const result = await this.auth.authenticate(body.email, body.password);
        if (!result.ok) {
            await this.auth.logSignInAttempt(body.email, false, { ipAddress });
            res.status(common_1.HttpStatus.UNAUTHORIZED);
            return { error: result.error };
        }
        res.cookie(auth_service_1.JWT_COOKIE_NAME, result.token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 8,
        });
        await this.auth.logSignInAttempt(body.email, true, {
            ipAddress,
            userId: result.userId,
            organisationId: result.organisationId,
        });
        return { ok: true, role: result.role };
    }
    async signup(req, body) {
        const auth = req.auth;
        if (!auth) {
            throw new common_1.HttpException('UNAUTHENTICATED', common_1.HttpStatus.UNAUTHORIZED);
        }
        try {
            const result = await this.auth.registerUser({
                organisationId: auth.organisationId,
                actorUserId: auth.sub,
                email: body.email,
                password: body.password,
                displayName: body.displayName,
                role: body.role,
            });
            return { ok: true, id: result.id };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : '';
            if (message === 'EMAIL_ALREADY_IN_USE') {
                throw new common_1.HttpException('EMAIL_ALREADY_IN_USE', common_1.HttpStatus.CONFLICT);
            }
            if (message === 'CANNOT_CREATE_ADMIN_VIA_API') {
                throw new common_1.HttpException('FORBIDDEN', common_1.HttpStatus.FORBIDDEN);
            }
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async bootstrapAdmin(body) {
        try {
            const result = await this.auth.bootstrapInitialAdmin({
                email: body.email,
                password: body.password,
                displayName: body.displayName,
            });
            return { ok: true, id: result.id, organisationId: result.organisationId };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : '';
            if (message === 'BOOTSTRAP_ALREADY_COMPLETED') {
                throw new common_1.HttpException('BOOTSTRAP_ALREADY_COMPLETED', common_1.HttpStatus.BAD_REQUEST);
            }
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('signup'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, capability_guard_1.CapabilityGuard),
    (0, capability_decorator_1.RequireCapability)(capabilities_1.CAPABILITIES.ATHLETES_MANAGE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signup", null);
__decorate([
    (0, common_1.Post)('bootstrap-admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "bootstrapAdmin", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map