"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.JWT_COOKIE_NAME = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcryptjs"));
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/audit.service");
const capabilities_1 = require("./capabilities");
exports.JWT_COOKIE_NAME = 'gw_auth';
const JWT_EXPIRES_IN_SECONDS = 60 * 60 * 8;
let AuthService = class AuthService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    getJwtSecret() {
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new Error('JWT_SECRET is not set');
        return secret;
    }
    signToken(payload) {
        return jwt.sign(payload, this.getJwtSecret(), {
            expiresIn: JWT_EXPIRES_IN_SECONDS,
        });
    }
    verifyToken(token) {
        try {
            return jwt.verify(token, this.getJwtSecret());
        }
        catch {
            return null;
        }
    }
    async authenticate(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                capabilities: { include: { capability: true } },
            },
        });
        if (!user)
            return { ok: false, error: 'INVALID_CREDENTIALS' };
        if (!user.isActive)
            return { ok: false, error: 'USER_DISABLED' };
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            return { ok: false, error: 'INVALID_CREDENTIALS' };
        const role = user.role;
        if (!role)
            return { ok: false, error: 'NO_ROLE' };
        const dbCapabilities = user.capabilities.map((uc) => uc.capability.code);
        const roleCapabilities = (0, capabilities_1.getCapabilitiesForRole)(role);
        const allCapabilities = [...new Set([...roleCapabilities, ...dbCapabilities])];
        const token = this.signToken({
            sub: user.id,
            organisationId: user.organisationId,
            role: role,
            capabilities: allCapabilities,
        });
        return {
            ok: true,
            userId: user.id,
            organisationId: user.organisationId,
            role: role,
            token,
        };
    }
    async logSignInAttempt(email, success, options) {
        await this.audit.write({
            organisationId: options?.organisationId ?? '',
            actorUserId: options?.userId ?? null,
            action: success ? 'SIGN_IN_SUCCESS' : 'SIGN_IN_FAILURE',
            entityType: 'auth',
            entityId: email,
            before: null,
            after: { success },
            reason: null,
            ipAddress: options?.ipAddress ?? null,
        });
    }
    async registerUser(params) {
        const { organisationId, actorUserId, email, password, displayName, role } = params;
        if (role === 'admin') {
            throw new Error('CANNOT_CREATE_ADMIN_VIA_API');
        }
        const passwordHash = await bcrypt.hash(password, 10);
        try {
            const user = await this.prisma.user.create({
                data: {
                    organisationId,
                    email,
                    passwordHash,
                    displayName,
                    role,
                    isActive: true,
                },
            });
            await this.audit.write({
                organisationId,
                actorUserId,
                action: 'USER_CREATED',
                entityType: 'user',
                entityId: user.id,
                before: null,
                after: {
                    email: user.email,
                    displayName: user.displayName,
                    role: user.role,
                },
                reason: null,
                ipAddress: null,
            });
            return { id: user.id };
        }
        catch (e) {
            if (e && typeof e === 'object' && e.code === 'P2002') {
                throw new Error('EMAIL_ALREADY_IN_USE');
            }
            throw e;
        }
    }
    async bootstrapInitialAdmin(params) {
        const userCount = await this.prisma.user.count();
        if (userCount > 0) {
            throw new Error('BOOTSTRAP_ALREADY_COMPLETED');
        }
        const org = (await this.prisma.organisation.findFirst()) ??
            (await this.prisma.organisation.create({
                data: {
                    name: 'Default Organisation',
                    slug: 'default',
                },
            }));
        const passwordHash = await bcrypt.hash(params.password, 10);
        const user = await this.prisma.user.create({
            data: {
                organisationId: org.id,
                email: params.email,
                passwordHash,
                displayName: params.displayName,
                role: 'admin',
                isActive: true,
            },
        });
        await this.audit.write({
            organisationId: org.id,
            actorUserId: null,
            action: 'INITIAL_ADMIN_BOOTSTRAP',
            entityType: 'user',
            entityId: user.id,
            before: null,
            after: {
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            },
            reason: 'Initial admin bootstrap',
            ipAddress: null,
        });
        return { id: user.id, organisationId: org.id };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map