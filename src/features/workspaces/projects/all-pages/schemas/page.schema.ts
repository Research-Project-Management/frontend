import { z } from 'zod';

// ── Page schema ─────────────────────────────────────────────────────────────

export const pageSchema = z.object({
  _id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  pdfThumbnail: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string(),
  workspaceId: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  projectId: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  parentPage: z.string().optional(),
  mainFile: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  author: z
    .object({
      _id: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      avatar: z.string().optional(),
    })
    .optional(),
});

// ── Create Page Input schema ────────────────────────────────────────────────

export const createPageSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type PageSchema = z.infer<typeof pageSchema>;
export type CreatePageSchema = z.infer<typeof createPageSchema>;
