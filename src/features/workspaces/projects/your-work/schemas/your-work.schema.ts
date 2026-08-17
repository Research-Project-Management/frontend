import { z } from 'zod';

export const yourWorkItemSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'page', 'file']),
  title: z.string(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  updatedAt: z.string(),
});

export const yourWorkSubtaskSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  title: z.string().optional(),
  completed: z.boolean().optional(),
  columnId: z.string().optional(),
  rank: z.string().optional(),
});

export const yourWorkUserRefSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  avatar: z.string().nullable().optional(),
});

export const yourWorkTaskSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  identifier: z.string().optional(),
  title: z.string(),
  columnId: z.string().optional().default('todo'),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().default('none'),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assignee: z.union([z.string(), yourWorkUserRefSchema]).nullable().optional(),
  authorId: z.string().nullable().optional(),
  author: z.union([z.string(), yourWorkUserRefSchema]).nullable().optional(),
  projectId: z.union([z.string(), z.object({ id: z.string().optional(), _id: z.string().optional(), name: z.string().optional() })]).optional(),
  project: z.object({ id: z.string().optional(), _id: z.string().optional(), name: z.string().optional() }).optional(),
  commentCount: z.number().optional().default(0),
  subtasks: z.array(yourWorkSubtaskSchema).optional().default([]),
  subtaskCount: z.number().optional(),
  subtaskCompletedCount: z.number().optional(),
  completed: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const yourWorkActivityEventSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  type: z.string(),
  actorName: z.string().optional(),
  actionVerb: z.string().optional(),
  targetIdentifier: z.string().nullable().optional(),
  targetTitle: z.string().nullable().optional(),
  content: z.string().optional(),
  time: z.string().optional(),
  itemId: z.string().optional(),
  project: z
    .union([
      z.string(),
      z.object({
        id: z.string().optional(),
        _id: z.string().optional(),
        name: z.string().optional(),
      }),
    ])
    .optional(),
  user: z
    .object({
      name: z.string().optional(),
      avatar: z.string().nullable().optional(),
    })
    .optional(),
});

export const yourWorkSummaryResponseSchema = z.object({
  assigned: z.array(yourWorkTaskSchema).optional().default([]),
  created: z.array(yourWorkTaskSchema).optional().default([]),
  subscribed: z.array(yourWorkTaskSchema).optional().default([]),
  activity: z.array(yourWorkActivityEventSchema).optional().default([]),
  recent: z.array(z.any()).optional().default([]),
  success: z.boolean().optional(),
});

export type YourWorkItem = z.infer<typeof yourWorkItemSchema>;
export type YourWorkTask = z.infer<typeof yourWorkTaskSchema>;
export type YourWorkSubtask = z.infer<typeof yourWorkSubtaskSchema>;
export type YourWorkActivityEvent = z.infer<typeof yourWorkActivityEventSchema>;
export type YourWorkSummaryResponse = z.infer<typeof yourWorkSummaryResponseSchema>;
