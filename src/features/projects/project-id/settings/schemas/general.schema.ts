import { z } from 'zod';

export const projectGeneralSchema = z.object({
  name: z.string().min(1, 'Project name is required').trim(),
  identifier: z
    .string()
    .min(1, 'Project ID is required')
    .max(12, 'Project ID must be at most 12 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Identifier must be uppercase letters, numbers, hyphens or underscores')
    .trim(),
  description: z.string(),
  researchField: z.string().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  avatar: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
});

export type ProjectGeneralFormValues = z.infer<typeof projectGeneralSchema>;
