import { z } from 'zod';

// Country/Region upsert bodies. `id` present → update, omitted → create.
// NOTE: ids are validated as plain non-empty strings (not .cuid()) because rows
// created by the backfill migration use UUIDs, so a strict cuid() check would
// reject edits to migrated countries/regions.
export const upsertCountrySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(120),
  nameKa: z.string().trim().min(1).max(120).optional().nullable(),
  // ISO-3166 alpha-2 (e.g. "GE"); uppercased server-side.
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional()
    .nullable(),
});

export const upsertRegionSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  countryId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  nameKa: z.string().trim().min(1).max(120).optional().nullable(),
});
