import { BadRequestException } from '@nestjs/common';
import type { z, ZodTypeAny } from 'zod';

/**
 * Parse a request body against a Zod schema, throwing a clean 400
 * `VALIDATION_ERROR` (matching the app-wide error contract) on failure instead
 * of letting an invalid enum/number/missing field reach Prisma as a 500.
 *
 * Use at the top of mutating controller handlers, OUTSIDE the service try/catch
 * so the BadRequestException isn't swallowed and re-mapped to a 500.
 */
export function parseBody<T extends ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}
