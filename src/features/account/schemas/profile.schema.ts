import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().max(50, 'Last name is too long').optional(),
  displayName: z.string().min(1, 'Display name is required').max(50, 'Display name is too long'),
  avatar: z.string().nullable().optional(),
});
