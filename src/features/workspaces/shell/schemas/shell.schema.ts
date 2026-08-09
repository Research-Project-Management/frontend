// ── Shell schemas ─────────────────────────────────────────────────────────────
// Zod schemas for shell-level data (search results, nav config, etc.)
import { z } from 'zod';

export const searchResultSchema = z.object({
  type: z.enum(['project', 'page', 'file', 'folder', 'sticky']),
  id: z.string(),
  name: z.string(),
  icon: z.string().nullish(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
