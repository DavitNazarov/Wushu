import { z } from 'zod';

// Country/City/Federation upsert bodies. `id` present → update, omitted → create.
// NOTE: ids are validated as plain non-empty strings (not .cuid()) because rows
// created by the backfill migration use UUIDs, so a strict cuid() check would
// reject edits to migrated rows.
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

export const upsertCitySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  countryId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  nameKa: z.string().trim().min(1).max(120).optional().nullable(),
});

export const upsertFederationSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  cityId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  nameKa: z.string().trim().min(1).max(160).optional().nullable(),
  isOfficial: z.boolean(),
});
