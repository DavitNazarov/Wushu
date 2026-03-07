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
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

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
      case 'P1017': {
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          body: {
            code: 'DATABASE_UNAVAILABLE',
            message:
              'Database is unreachable. Ensure PostgreSQL is running and DATABASE_URL is correct.',
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
