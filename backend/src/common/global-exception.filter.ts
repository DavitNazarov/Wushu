import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

// Error aggregation is env-gated: without SENTRY_DSN the SDK is never
// initialised and captureException is a no-op-safe call we skip entirely.
const SENTRY_ENABLED = Boolean(process.env.SENTRY_DSN?.trim());

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // LOW-1: error responses must NEVER be cached. The public read controllers
    // declare `@Header('Cache-Control', CACHE_LONG)`, which Nest applies to the
    // response BEFORE the handler runs — so a thrown 404/500 would otherwise go
    // out with `public, max-age=30` and an edge/CDN could cache the error.
    // Forcing no-store here (overwriting any handler-set value) covers every
    // route from one place, on every error path below.
    response.setHeader('Cache-Control', 'no-store');

    // Zod validation errors
    if (exception instanceof ZodError) {
      logger.error(
        {
          type: 'ZodError',
          issues: exception.issues,
          path: request.url,
          method: request.method,
        },
        'Request validation failed',
      );

      return response.status(HttpStatus.BAD_REQUEST).json({
        code: 'VALIDATION_ERROR',
        issues: exception.issues,
      });
    }

    // Explicit HTTP exceptions thrown in code (e.g. INVALID_CLUB)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();

      logger.error(
        {
          type: 'HttpException',
          status,
          response: responseBody,
          path: request.url,
          method: request.method,
        },
        'HTTP exception thrown',
      );

      return response.status(status).json(responseBody);
    }

    // Prisma known request errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const statusAndBody = this.mapPrismaError(exception);

      logger.error(
        {
          type: 'PrismaClientKnownRequestError',
          code: exception.code,
          meta: exception.meta,
          message: exception.message,
          path: request.url,
          method: request.method,
        },
        'Prisma known request error',
      );

      return response.status(statusAndBody.status).json(statusAndBody.body);
    }

    // REL-3: connection/initialization failures (connect refused, auth failure,
    // pool can't be established) are NOT KnownRequestErrors — without this they
    // fall through to a generic 500. Map to 503 so a DB blip degrades gracefully.
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      (exception instanceof Error &&
        exception.name === 'PrismaClientInitializationError')
    ) {
      logger.error(
        {
          type: 'PrismaClientInitializationError',
          message: exception instanceof Error ? exception.message : undefined,
          path: request.url,
          method: request.method,
        },
        'Database connection/initialization error',
      );
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable. Please retry shortly.',
      });
    }

    // Unknown / unhandled errors
    logger.error(
      {
        type: 'UnknownError',
        error:
          exception instanceof Error
            ? {
                name: exception.name,
                message: exception.message,
                stack: exception.stack,
              }
            : exception,
        path: request.url,
        method: request.method,
      },
      'Unhandled exception',
    );

    // Only genuinely unhandled errors reach Sentry — expected error paths
    // above (validation, HTTP exceptions, mapped Prisma codes) stay out so the
    // signal is real bugs, not user input. No request body/PII is attached.
    if (SENTRY_ENABLED) {
      Sentry.captureException(exception, {
        tags: { path: request.url, method: request.method },
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: unknown;
  } {
    switch (error.code) {
      case 'P1001':
      case 'P1002':
      case 'P1017':
      // REL-3: P2024 = timed out fetching a connection from the pool (pool
      // exhaustion under load). Surface as 503 so clients back off + retry
      // rather than treating it as a hard 500.
      case 'P2024': {
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          body: {
            code: 'DATABASE_UNAVAILABLE',
            message:
              'Database is temporarily unavailable. Please retry shortly.',
          },
        };
      }
      case 'P2003': {
        const field =
          (error.meta?.field_name as string | undefined) ??
          (error.meta?.fieldName as string | undefined) ??
          undefined;
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            code: 'FOREIGN_KEY',
            field,
            message: 'Invalid relation id',
          },
        };
      }
      case 'P2002': {
        const target = error.meta?.target as string[] | undefined;
        const field =
          Array.isArray(target) && target.length > 0 ? target[0] : undefined;
        const message =
          field === 'slug'
            ? 'A news post with this slug already exists. Use a different slug or edit the existing post.'
            : 'A record with this value already exists.';
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: 'UNIQUE_CONSTRAINT',
            field,
            message,
          },
        };
      }
      case 'P2021':
      case 'P2022': {
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          body: {
            code: 'DATABASE_SCHEMA_OUT_OF_DATE',
            message:
              'The app was recently updated and the database needs a quick update to match. ' +
              'Apply the latest database migration, then reload this page. ' +
              '(In development run “npm run prisma:migrate”; in production run “npx prisma migrate deploy”.)',
          },
        };
      }
      case 'P2025': {
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            code: 'NOT_FOUND',
          },
        };
      }
      default: {
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
          },
        };
      }
    }
  }
}
