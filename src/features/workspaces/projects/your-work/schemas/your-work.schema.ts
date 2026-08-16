import { z } from 'zod';

export const yourWorkItemSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'page', 'file']),
  title: z.string(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  updatedAt: z.string(),
});

export const yourWorkActivityEventSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  actorName: z.string().optional(),
  actionVerb: z.string().optional(),
  targetIdentifier: z.string().optional(),
  targetTitle: z.string().optional(),
  content: z.string().optional(),
  time: z.string().optional(),
  itemId: z.string().optional(),
  project: z
    .union([
      z.string(),
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
      }),
    ])
    .optional(),
  user: z
    .object({
      name: z.string().optional(),
      avatar: z.string().optional(),
    })
    .optional(),
});

export const yourWorkSummaryResponseSchema = z.object({
  assigned: z.array(z.any()).optional().default([]),
  created: z.array(z.any()).optional().default([]),
  subscribed: z.array(z.any()).optional().default([]),
  activity: z.array(yourWorkActivityEventSchema).optional().default([]),
});

export type YourWorkItem = z.infer<typeof yourWorkItemSchema>;
export type YourWorkActivityEvent = z.infer<typeof yourWorkActivityEventSchema>;
export type YourWorkSummaryResponse = z.infer<typeof yourWorkSummaryResponseSchema>;
