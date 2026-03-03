import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthTokenPayload } from './auth.service';
export type AuthenticatedRequest = Request & {
    auth?: AuthTokenPayload;
};
export declare class AuthGuard implements CanActivate {
    private readonly auth;
    constructor(auth: AuthService);
    canActivate(context: ExecutionContext): boolean;
}
