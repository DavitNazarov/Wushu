import { z } from 'zod';

// POST /api/coaches body. `id` present → update, omitted → create. clubId is
// optional; city/country are derived from it server-side.
export const upsertCoachSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  firstName: z.string().trim().min(1).max(120),
  firstNameKa: z.string().trim().min(1).max(120).optional().nullable(),
  lastName: z.string().trim().min(1).max(120).optional().nullable(),
  lastNameKa: z.string().trim().min(1).max(120).optional().nullable(),
  nationality: z.enum(['GE']).optional().nullable(),
  clubId: z.string().min(1).max(64).optional().nullable(),
});
