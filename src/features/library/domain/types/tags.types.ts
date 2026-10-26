import { z } from 'zod';

export const tagTypeSchema = z.enum(['manual', 'automatic', 'ai']);

export const tagSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional().default('#3b82f6'),
  shortcut: z.number().int().min(1).max(9).nullable().optional(),
  type: tagTypeSchema.or(z.string()).optional().default('manual'),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
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
  shortcut: z.number().int().min(1).max(9).nullable().optional(),
  type: tagTypeSchema.optional().default('manual'),
  projectId: z.string().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  shortcut: z.number().int().min(1).max(9).nullable().optional(),
  type: tagTypeSchema.optional(),
  projectId: z.string().optional(),
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
