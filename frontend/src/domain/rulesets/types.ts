import type { Ruleset, RulesetStatus } from '@prisma/client';

export type RulesetDefinition = unknown;

export type RulesetWithMeta = Ruleset;

export const RULESET_STATUS: Record<RulesetStatus, RulesetStatus> = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
};

