import { z } from 'zod';

export const upsertClubSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(1).max(120),
  nameKa: z.string().trim().min(1).max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
});

export type UpsertClubInput = z.infer<typeof upsertClubSchema>;
