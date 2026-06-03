import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  .regex(/\d/, { message: 'Password must contain at least one number' });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: 'Password is required' }),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  displayName: z.string().trim().min(1),
  role: z.enum(['admin', 'coach']),
  clubId: z.string().cuid().nullable().optional(),
  nationality: z.string().trim().min(1).nullable().optional(),
});

export const bootstrapAdminSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  displayName: z.string().trim().min(1),
  bootstrapSecret: z.string().optional(),
});
