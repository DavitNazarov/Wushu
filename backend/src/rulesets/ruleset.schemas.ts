import { z } from 'zod';

const WeightCategoryInputSchema = z
  .object({
    name: z.string().min(1),
    minWeightKgExcl: z.number().nullable().optional(),
    maxWeightKgIncl: z.number().nullable().optional(),
    sortOrder: z.number().int().positive().optional(),
  })
  .strict();

const AgeGroupInputSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1),
    sex: z.enum(['MALE', 'FEMALE']).nullable().optional(),
    minAge: z.number().int().min(0).nullable().optional(),
    maxAge: z.number().int().min(0).nullable().optional(),
    roundDurationSeconds: z.number().int().positive().optional(),
    sortOrder: z.number().int().positive().optional(),
    weightCategories: z.array(WeightCategoryInputSchema).min(1),
  })
  .strict();

export const CreateRulesetSchema = z
  .object({
    name: z.string().min(1),
    status: z.enum(['DRAFT', 'ACTIVE']).optional(),
    definition: z.record(z.string(), z.unknown()).optional(),
    ageGroups: z.array(AgeGroupInputSchema).min(1).optional(),
  })
  .strict();

export const UpdateRulesetStructureSchema = z
  .object({
    ageGroups: z.array(AgeGroupInputSchema).min(1),
    definition: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['DRAFT', 'ACTIVE']).optional(),
  })
  .strict();

export type CreateRulesetDto = z.infer<typeof CreateRulesetSchema>;
export type UpdateRulesetStructureDto = z.infer<typeof UpdateRulesetStructureSchema>;
export type RulesetAgeGroupInput = z.infer<typeof AgeGroupInputSchema>;
