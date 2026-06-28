import { BadRequestException } from '@nestjs/common';

/**
 * Guard an id before it feeds a `where: { id, organisationId }` clause.
 *
 * Prisma strips `undefined` keys, so `findFirst({ where: { id: undefined,
 * organisationId } })` silently collapses to `where: { organisationId }` and
 * matches the FIRST row in the org — and for `deleteMany`/`updateMany` that
 * widens the blast radius to EVERY row in the tenant. Throw a clean 400 in the
 * app-wide `{ message, code }` shape instead of letting an undefined/empty id
 * reach the database.
 */
export function assertId(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException({ message: code, code });
  }
  return value;
}
