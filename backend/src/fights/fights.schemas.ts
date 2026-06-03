import { z } from 'zod';

// Zod schemas for the mutating fights endpoints. The global ZodValidationPipe
// is a no-op unless a DTO exposes `.schema`, so these are applied explicitly
// via parseBody() in the controller — validating enums/numbers BEFORE they
// reach the service/Prisma (SEC-2).

const optionalReason = z.string().trim().max(500).optional();
// Optimistic-concurrency token: the client echoes the fight/timer updatedAt.
// The service compares it; we only need it to be a non-empty string here.
const optionalStamp = z.string().trim().min(1).max(64).optional();

export const fightStateSchema = z.object({
  to: z.enum([
    'QUEUED',
    'ON_DECK',
    'IN_PROGRESS',
    'PAUSED',
    'COMPLETE',
    'CONFIRMED',
  ]),
  override: z.boolean().optional(),
  reason: optionalReason,
});

export const fightResultSchema = z.object({
  winner: z.enum(['RED', 'BLUE']),
  method: z.enum(['POINTS', 'KO', 'DQ', 'WO']),
  notes: z.string().trim().max(2000).optional(),
  override: z.boolean().optional(),
  reason: optionalReason,
  // BF-2 optimistic-concurrency token: client echoes the fight.updatedAt it saw.
  expectedUpdatedAt: optionalStamp,
});

export const timerActionSchema = z.object({
  action: z.enum(['START', 'PAUSE', 'RESUME', 'RESET']),
  round: z.number().int().min(1).max(50).optional(),
  expectedUpdatedAt: optionalStamp,
});

export const roundResultSchema = z.object({
  winner: z.enum(['RED', 'BLUE']),
  expectedUpdatedAt: optionalStamp,
});
