import Express from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.guard';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    me(req: Express.Request): {
        userId: null;
        organisationId: null;
        role: null;
        capabilities: never[];
    } | {
        userId: string;
        organisationId: string;
        role: import("./capabilities").UserRole;
        capabilities: string[];
    };
    login(body: {
        email: string;
        password: string;
    }, res: Express.Response, req: Express.Request): Promise<{
        error: "USER_DISABLED" | "NO_ROLE" | "INVALID_CREDENTIALS";
        ok?: undefined;
        role?: undefined;
    } | {
        ok: boolean;
        role: import("./capabilities").UserRole;
        error?: undefined;
    }>;
    signup(req: AuthenticatedRequest, body: {
        email: string;
        password: string;
        displayName: string;
        role: 'coach' | 'athlete';
    }): Promise<{
        ok: boolean;
        id: string;
    }>;
    bootstrapAdmin(body: {
        email: string;
        password: string;
        displayName: string;
    }): Promise<{
        ok: boolean;
        id: string;
        organisationId: string;
    }>;
}
