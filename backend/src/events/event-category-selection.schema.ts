import { z } from 'zod';

const CategorySelectionAgeGroupSchema = z
  .object({
    categoryTemplateGroupId: z.string().min(1).optional(),
    rulesetAgeGroupId: z.string().min(1).optional(),
    weightCategoryIds: z.array(z.string().min(1)),
  })
  .strict()
  .transform((value) => ({
    categoryTemplateGroupId:
      value.categoryTemplateGroupId ?? value.rulesetAgeGroupId ?? '',
    weightCategoryIds: value.weightCategoryIds,
  }));

export const EventCategorySelectionSchema = z
  .object({
    categoryTemplateId: z.string().min(1).optional(),
    rulesetId: z.string().min(1).optional(),
    ageGroups: z.array(CategorySelectionAgeGroupSchema),
  })
  .strict()
  .transform((value) => ({
    categoryTemplateId: value.categoryTemplateId ?? value.rulesetId ?? '',
    ageGroups: value.ageGroups,
  }))
  .superRefine((value, ctx) => {
    if (!value.categoryTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryTemplateId'],
        message: 'categoryTemplateId is required',
      });
    }

    value.ageGroups.forEach((ageGroup, index) => {
      if (!ageGroup.categoryTemplateGroupId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ageGroups', index, 'categoryTemplateGroupId'],
          message: 'categoryTemplateGroupId is required',
        });
      }
    });
  });

export type EventCategorySelectionDto = z.infer<
  typeof EventCategorySelectionSchema
>;
