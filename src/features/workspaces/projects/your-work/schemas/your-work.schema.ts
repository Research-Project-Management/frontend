import { z } from 'zod';

export const yourWorkItemSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'page', 'file']),
  title: z.string(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  updatedAt: z.string(),
});

export type YourWorkItem = z.infer<typeof yourWorkItemSchema>;
