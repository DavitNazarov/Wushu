import { z } from 'zod';

// POST /api/clubs body. `id` makes it an upsert: omitted → create, present →
// update. 120-char ceilings everywhere match the DB column widths so we fail
// fast before Prisma rejects the row. nameKa is the bilingual Georgian name
// — required to be non-empty when provided; controller turns "" into null.
// regionId is required (a club always belongs to a region); its country is
// derived server-side. Not .cuid() because regions created by the backfill
// migration have UUID ids.
export const upsertClubSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(1).max(120),
  nameKa: z.string().trim().min(1).max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  regionId: z.string().min(1).max(64),
});

