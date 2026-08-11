import { z } from 'zod';

export const GeneralSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  url: z.string().optional(),
  avatar: z.string().nullable().optional(),
  teamSize: z.enum(['1', '2-10', '11-50', '51-200', '201-500', '500+']),
});

export const AddMemberBodySchema = z.object({
  userId: z.string(),
  role: z.string(),
});

export const UpdateMemberRoleBodySchema = z.object({
  role: z.string(),
});
