import { z } from 'zod';

export const CategoryTemplateStatusSchema = z.enum(['DRAFT', 'ACTIVE']);
export const CategoryTemplateTypeSchema = z.enum(['SYSTEM', 'CUSTOM', 'OFFICIAL']);

export const CreateCategoryTemplateSchema = z
  .object({
    name: z.string().trim().min(1),
    categoryOptionIds: z.array(z.string().min(1)).min(1),
    status: CategoryTemplateStatusSchema.optional(),
  })
  .strict();

export const UpdateCategoryTemplateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    categoryOptionIds: z.array(z.string().min(1)).min(1).optional(),
    status: CategoryTemplateStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.categoryOptionIds !== undefined ||
      value.status !== undefined,
    {
      message: 'At least one field must be provided',
    },
  );

export const CategoryTemplateListQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    status: CategoryTemplateStatusSchema.optional(),
    type: CategoryTemplateTypeSchema.optional(),
  })
  .strict();

export type CreateCategoryTemplateDto = z.infer<
  typeof CreateCategoryTemplateSchema
>;
export type UpdateCategoryTemplateDto = z.infer<
  typeof UpdateCategoryTemplateSchema
>;
export type CategoryTemplateListQueryDto = z.infer<
  typeof CategoryTemplateListQuerySchema
>;
