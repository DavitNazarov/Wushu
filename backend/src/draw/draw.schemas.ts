import { z } from 'zod';

// Explicit Zod schemas for the mutating draw endpoints. Ids are cuids
// (Prisma `@default(cuid())`); validating them here stops an undefined/empty
// eventId from collapsing a service `where: { id, organisationId }` filter
// (Prisma strips undefined keys) and clobbering the wrong — or every — event.

const eventId = z.string().cuid();
const eventWeightCategoryId = z.string().cuid();
const reason = z.string().optional();

// POST /api/draw/reset — destructive teardown, so the id MUST be present.
export const resetDrawSchema = z.object({
  eventId,
  override: z.boolean().optional(),
  reason,
});

// POST /api/draw/category/unreview
export const unreviewCategorySchema = z.object({
  eventId,
  eventWeightCategoryId,
});
