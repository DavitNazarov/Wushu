import { z } from 'zod';

export const EventPolicyInputSchema = z
  .object({
    weighInPolicyCode: z
      .enum([
        'IWUF_STRICT_ONE_HOUR',
        'MOVE_UP_AFTER_FAILED_REWEIGH',
        'DIRECT_MOVE_UP',
        'MANUAL_ADMIN_DECISION',
      ])
      .optional(),
    bronzePolicyCode: z.enum(['TWO_BRONZES']).optional(),
    restPolicyCode: z.enum(['MIN_15_MINUTES']).optional(),
    minRestMinutes: z.number().int().positive().optional(),
    publishTimingPolicyCode: z
      .enum([
        'IMMEDIATE_AFTER_DRAW',
        'MANUAL_PUBLISH_LATER',
        'COMPETITION_DAY_ONLY',
      ])
      .optional(),
    reweighWindowMinutes: z.number().int().positive().optional(),
  })
  .strict();

export type EventPolicyInputDto = z.infer<typeof EventPolicyInputSchema>;
