import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, JWT_COOKIE_NAME } from './auth.service';
import type { AuthTokenPayload } from './auth.service';

export type AuthenticatedRequest = Request & { auth?: AuthTokenPayload };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token =
      req.cookies?.[JWT_COOKIE_NAME] ??
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const payload = this.auth.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    req.auth = payload;
    return true;
  }
}
