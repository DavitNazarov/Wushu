import { z } from 'zod';

const CategoryTemplateDefinitionSchema = z
  .object({
    type: z.literal('CATEGORY_TEMPLATE').optional(),
    source: z.string().optional(),
    categoryOptionIds: z.array(z.string()).optional(),
    optionGroupCodes: z.array(z.string()).optional(),
  })
  .passthrough();

type CategoryTemplateDefinition = z.infer<
  typeof CategoryTemplateDefinitionSchema
>;

export type CategoryTemplateType = 'SYSTEM' | 'CUSTOM' | 'OFFICIAL';

function parseCategoryTemplateDefinition(
  value: unknown,
): CategoryTemplateDefinition {
  const parsed = CategoryTemplateDefinitionSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function getCategoryTemplateType(input: {
  organisationId: string | null;
  definition: unknown;
}): CategoryTemplateType {
  const definition = parseCategoryTemplateDefinition(input.definition);

  if (definition.source === 'OFFICIAL_LIBRARY') return 'OFFICIAL';
  if (!input.organisationId || definition.source === 'SYSTEM_BUILT_IN') {
    return 'SYSTEM';
  }

  return 'CUSTOM';
}

export function getTemplateSourceLabel(definition: unknown): string | null {
  const parsed = parseCategoryTemplateDefinition(definition);
  return parsed.source ?? null;
}

export function getCategoryOptionIds(definition: unknown): string[] {
  const parsed = parseCategoryTemplateDefinition(definition);
  return [...new Set(parsed.categoryOptionIds ?? [])];
}
