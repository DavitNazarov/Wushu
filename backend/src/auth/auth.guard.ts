import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, JWT_COOKIE_NAME } from './auth.service';
import type { AuthTokenPayload } from './auth.service';

export type AuthenticatedRequest = Request & { auth?: AuthTokenPayload };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const rawCookieToken = cookies?.[JWT_COOKIE_NAME];
    const cookieToken =
      typeof rawCookieToken === 'string' ? rawCookieToken : null;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const payload = this.auth.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const validated = await this.auth.validateAuthenticatedUser(payload.sub);
    if (!validated.ok) {
      if (validated.code === 'USER_SUSPENDED') {
        throw new ForbiddenException({
          code: 'USER_SUSPENDED',
          message: 'Your account is temporarily suspended',
        });
      }
      throw new ForbiddenException({
        code: validated.code,
        message:
          validated.code === 'USER_ARCHIVED'
            ? 'Your account is no longer available'
            : 'Your account is disabled',
      });
    }

    req.auth = validated.payload;
    return true;
  }
}
