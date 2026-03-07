import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.guard';

export const REQUIRE_CAPABILITY = 'require_capability';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string>(
      REQUIRE_CAPABILITY,
      context.getHandler(),
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = req.auth;

    if (!auth) {
      throw new ForbiddenException('UNAUTHENTICATED');
    }

    if (!auth.capabilities.includes(required)) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return true;
  }
}
