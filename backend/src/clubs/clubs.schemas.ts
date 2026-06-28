import { z } from 'zod';

// POST /api/clubs body. `id` makes it an upsert: omitted → create, present →
// update. nameKa is the bilingual Georgian name — required non-empty when
// provided; controller turns "" into null. cityId is required (a club always
// belongs to a city); its country is derived server-side. federationId is
// optional (a club may sit directly under a city). Ids are plain strings (not
// .cuid()) because rows from the backfill migration use UUIDs.
export const upsertClubSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(120),
  nameKa: z.string().trim().min(1).max(120).optional().nullable(),
  cityId: z.string().min(1).max(64),
  federationId: z.string().min(1).max(64).optional().nullable(),
  isOfficial: z.boolean(),
});
