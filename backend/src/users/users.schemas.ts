import { z } from 'zod';

const userRoleSchema = z.enum(['admin', 'coach']);

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  displayName: z.string().trim().min(1),
  role: userRoleSchema,
  clubId: z.string().cuid().optional().nullable(),
  nationality: z.string().trim().optional().nullable(),
});

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

export const suspendUserSchema = z.object({
  reason: z.string().trim().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  note: z.string().trim().optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
