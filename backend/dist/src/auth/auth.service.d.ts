import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { type UserRole } from './capabilities';
export declare const JWT_COOKIE_NAME = "gw_auth";
export type AuthTokenPayload = {
    sub: string;
    organisationId: string;
    role: UserRole;
    capabilities: string[];
};
export declare class AuthService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    private getJwtSecret;
    signToken(payload: AuthTokenPayload): string;
    verifyToken(token: string): AuthTokenPayload | null;
    authenticate(email: string, password: string): Promise<{
        ok: true;
        userId: string;
        organisationId: string;
        role: UserRole;
        token: string;
    } | {
        ok: false;
        error: 'USER_DISABLED' | 'NO_ROLE' | 'INVALID_CREDENTIALS';
    }>;
    logSignInAttempt(email: string, success: boolean, options?: {
        ipAddress?: string | null;
        userId?: string;
        organisationId?: string;
    }): Promise<void>;
    registerUser(params: {
        organisationId: string;
        actorUserId: string;
        email: string;
        password: string;
        displayName: string;
        role: UserRole;
    }): Promise<{
        id: string;
    }>;
    bootstrapInitialAdmin(params: {
        email: string;
        password: string;
        displayName: string;
    }): Promise<{
        id: string;
        organisationId: string;
    }>;
}
