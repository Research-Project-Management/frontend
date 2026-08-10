import { z } from 'zod';

export const SearchResultTypeSchema = z.enum([
  'project',
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
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
});
