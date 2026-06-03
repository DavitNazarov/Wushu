import { z } from 'zod';

// Zod schemas for the admin users API. The controller only accepts these two
// roles — judges / timekeepers / athletes are out of scope for /admin/users.
const userRoleSchema = z.enum(['admin', 'coach']);

// POST /admin/users body. SEC-11: admin-created users must meet the same
// password policy as public signup (≥8 chars, at least one letter and one
// number) — previously the floor here was a weak 6 chars. clubId is a CUID
// because Prisma's default id format is CUID, not UUID.
const userPasswordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  .regex(/\d/, { message: 'Password must contain at least one number' });

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: userPasswordSchema,
  displayName: z.string().trim().min(1),
  role: userRoleSchema,
  clubId: z.string().cuid().optional().nullable(),
  nationality: z.string().trim().optional().nullable(),
});

// PATCH /admin/users/:id body. All fields optional, but `.refine` rejects
// an empty body so the API can't silently no-op (and so we never write a
// useless audit row for "nothing changed").
export const updateUserSchema = z
  .object({
    email: z.string().trim().email().optional(),
    displayName: z.string().trim().min(1).optional(),
    role: userRoleSchema.optional(),
    clubId: z.string().cuid().optional().nullable(),
    nationality: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

// POST /admin/users/:id/dq body. startAt/endAt are ISO datetime strings;
// the service parses them into Dates and validates the range (end > start
// AND end > now) — those range rules live in the service, not the schema,
// so the same `INVALID_DQ_RANGE` error code surfaces consistently.
export const suspendUserSchema = z.object({
  reason: z.string().trim().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  note: z.string().trim().optional().nullable(),
});

// Inferred TypeScript types for the controller to use without redeclaring.
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
