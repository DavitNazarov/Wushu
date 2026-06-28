import { z } from 'zod';

// Shape + type validation for the integrity lock body, matching the rest of the
// controllers. eventId is a cuid (Prisma `@default(cuid())`); without it an
// undefined eventId would collapse the service `where: { id, organisationId }`
// lookup to the first event in the org.
export const integrityLockSchema = z.object({
  eventId: z.string().cuid(),
  override: z.boolean().optional(),
  reason: z.string().optional(),
});
