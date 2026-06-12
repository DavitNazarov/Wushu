import { z } from 'zod';

/**
 * Admin-managed weight-category library (CategoryOptionGroup + CategoryOption).
 * A "group" is an age/sex division (e.g. "Adults Men Sanda"); its "weights" are
 * the weight divisions inside it (e.g. "60kg"). These feed the Category Template
 * builder and, through templates, event creation.
 */

const WeightInputSchema = z
  .object({
    // Present when editing an existing weight; absent for newly added rows.
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1),
    minWeightKgExcl: z.number().min(0).nullable(),
    maxWeightKgIncl: z.number().positive().nullable(),
  })
  .strict();

const CategoryOptionGroupInputSchema = z
  .object({
    name: z.string().trim().min(1),
    // Bilingual display name (Georgian). Optional; falls back to `name`.
    nameKa: z.string().trim().min(1).nullable().optional(),
    sex: z.enum(['MALE', 'FEMALE']).nullable().optional(),
    minAge: z.number().int().min(0).nullable().optional(),
    maxAge: z.number().int().min(0).nullable().optional(),
    roundDurationSeconds: z.number().int().positive(),
    isActive: z.boolean().optional(),
    weights: z.array(WeightInputSchema).min(1),
  })
  .strict();

export const CreateCategoryOptionGroupSchema = CategoryOptionGroupInputSchema;
export const UpdateCategoryOptionGroupSchema = CategoryOptionGroupInputSchema;

export type CategoryOptionGroupInputDto = z.infer<
  typeof CategoryOptionGroupInputSchema
>;
