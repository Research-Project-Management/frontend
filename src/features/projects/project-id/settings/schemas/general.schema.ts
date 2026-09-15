import { z } from 'zod';

export const projectGeneralSchema = z.object({
  name: z.string().min(1, 'Project name is required').trim(),
  identifier: z
    .string()
    .min(1, 'Project ID is required')
    .max(12, 'Project ID must be at most 12 characters')
    .trim(),
  description: z.string(),
  isPrivate: z.boolean(),
  avatar: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
});

export type ProjectGeneralFormValues = z.infer<typeof projectGeneralSchema>;
