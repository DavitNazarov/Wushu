import { z } from 'zod';

// Explicit Zod schemas for the mutating weigh-in endpoints (SEC-2). weightKg in
// particular must be a real positive number — it flows into decision logic and
// Prisma; an unvalidated string/NaN today reaches the service as a 500.

const optionalReason = z.string().trim().max(500).optional();
const weightKg = z.number().positive().max(500);

export const weighInRecordSchema = z.object({
  registrationId: z.string().trim().min(1),
  weightKg,
  decision: z
    .enum(['PASS', 'MOVED_UP', 'REWEIGH', 'FAIL', 'ONE_HOUR', 'DISQUALIFIED'])
    .optional(),
  override: z.boolean().optional(),
  reason: optionalReason,
  nextEventWeightCategoryId: z.string().trim().min(1).optional(),
});

export const weighInPreviewSchema = z.object({
  registrationId: z.string().trim().min(1),
  weightKg,
});

export const resolveOneHourSchema = z.object({
  action: z.enum(['MOVE_UP', 'DQ']),
  nextEventWeightCategoryId: z.string().trim().min(1).optional(),
  newCategoryCode: z.string().trim().min(1).optional(),
  reason: optionalReason,
});
