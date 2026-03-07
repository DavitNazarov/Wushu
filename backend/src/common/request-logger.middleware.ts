import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import pino from 'pino';

type AuthPayload = {
  sub?: string;
  organisationId?: string;
};

type RequestWithAuth = Request & {
  auth?: AuthPayload;
};

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: RequestWithAuth, res: Response, next: NextFunction) {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    const startedAt = Date.now();
    const requestPath = req.originalUrl ?? req.url;

    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      logger.info({
        requestId,
        method: req.method,
        path: requestPath,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        actorUserId: req.auth?.sub ?? null,
        organisationId: req.auth?.organisationId ?? null,
        ip: req.ip,
      });
    });

    next();
  }
}
