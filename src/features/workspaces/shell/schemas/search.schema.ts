import { z } from 'zod';

export const SearchResultTypeSchema = z.enum([
  'project',
  'task',
  'paper',
  'page',
  'file',
  'folder',
  'sticky',
]);

export const SearchResultSchema = z.object({
  type: SearchResultTypeSchema,
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable().optional(),
  identifier: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  content: z.string().optional(),
  color: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const SearchResponseSchema = z.union([
  z.array(SearchResultSchema),
  z.object({
    results: z.array(SearchResultSchema),
  }),
]);
