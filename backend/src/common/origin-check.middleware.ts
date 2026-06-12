import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getAllowedCorsOrigins } from '../config/runtime-env';

// Methods that never change state — exempt from the Origin check.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defense-in-depth CSRF guard on top of SameSite=lax cookies + the CORS
// allow-list: any state-changing request that carries an Origin header must
// come from an allowed origin. Requests WITHOUT an Origin header pass —
// those are server-to-server calls (curl, healthchecks, load tests), which
// CSRF doesn't apply to. This matters most if COOKIE_SAME_SITE is ever set
// to 'none' for a cross-site deployment, where SameSite stops protecting.
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  // Resolved once — same lifetime as the CORS delegate in main.ts.
  private readonly allowedOrigins = new Set(getAllowedCorsOrigins());

  use(req: Request, res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }

    const normalized = origin.trim().replace(/\/+$/, '');
    if (this.allowedOrigins.has(normalized)) {
      next();
      return;
    }

    res.status(403).json({
      code: 'FORBIDDEN_ORIGIN',
      message: 'Cross-origin request rejected',
    });
  }
}
