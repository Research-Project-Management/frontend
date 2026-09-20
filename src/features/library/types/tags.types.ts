import { z } from 'zod';

export const tagSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional().default('#3b82f6'),
  type: z.enum(['manual', 'automatic']).or(z.string()).optional().default('manual'),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  workspaceId: z.string().optional(),
  _count: z.object({
    itemTags: z.number(),
  }).optional(),
  itemCount: z.number().optional().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional().default('#3b82f6'),
  type: z.string().optional().default('manual'),
});

export const updateTagSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
});

export const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string()),
  targetTagId: z.string(),
});

export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = Tag;

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type MergeTagsInput = z.infer<typeof mergeTagsSchema>;
