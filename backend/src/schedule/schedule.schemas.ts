import { z } from 'zod';

// Explicit Zod schemas for the mutating schedule endpoints (SEC-2). The numeric
// fields (durations, order indices, seed) and id arrays were previously passed
// straight through with `?? default` fallbacks — a string/NaN could corrupt the
// generated schedule or reach Prisma as a 500.

const reason = z.string().trim().max(500).nullish();
const seconds = z.number().int().min(0).max(86_400);
const orderInt = z.number().int().min(0).max(100_000);
const id = z.string().trim().min(1).max(64);

export const upsertSessionSchema = z.object({
  eventId: id,
  id: id.optional(),
  name: z.string().trim().min(1).max(200),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  order: orderInt.optional(),
});

export const upsertMatSchema = z.object({
  eventId: id,
  id: id.optional(),
  name: z.string().trim().min(1).max(100),
  order: orderInt.optional(),
});

export const generateScheduleSchema = z.object({
  eventId: id,
  avgBoutSeconds: seconds.optional(),
  bufferSeconds: seconds.optional(),
  override: z.boolean().optional(),
  reason,
});

export const moveFightToSessionSchema = z.object({
  fightId: id,
  toSessionId: id.nullable(),
  insertAfterOrder: orderInt.optional(),
  override: z.boolean().optional(),
  reason,
});

export const reorderSessionsSchema = z.object({
  eventId: id,
  sessionIds: z.array(id).max(1000),
});

export const reorderFightsSchema = z.object({
  sessionId: id,
  orderedFightIds: z.array(id).max(10_000),
});

export const autoScheduleSchema = z.object({
  eventId: id,
  startTimeIso: z.string().trim().min(1),
  avgBoutSeconds: seconds.optional(),
  bufferSeconds: seconds.optional(),
  restMinutes: z.number().int().min(0).max(1440).optional(),
  seed: z.number().int().optional(),
  override: z.boolean().optional(),
  reason,
  useSessions: z.boolean().optional(),
});

export const moveFightSchema = z.object({
  fightId: id,
  toMatId: id,
  toOrder: orderInt,
  override: z.boolean().optional(),
  reason,
});
