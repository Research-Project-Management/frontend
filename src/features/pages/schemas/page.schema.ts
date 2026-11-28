import { z } from 'zod';

// ── Page schema (for list / grid views in project scope) ────────────────────

export const pageStatusSchema = z.enum(['draft', 'published', 'archived']);

export const pageSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.unknown().optional(),
  status: pageStatusSchema.optional(),
  thumbnail: z.string().optional(),
  pdfThumbnail: z.string().optional(),
  labels: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string().default('#3b82f6'),
      })
    )
    .default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  spaceId: z.string().optional(),
  projectId: z.string().optional(),
  mainFileId: z.string().nullable().optional(),
  mainFile: z.union([z.string(), z.object({ id: z.string(), title: z.string().optional() })]).optional(),
  author: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      avatar: z.string().optional(),
    })
    .optional(),
});

// ── Create Page Input schema (space-scoped) ─────────────────────────────────

export const createPageSchema = z.object({
  spaceId: z.string().min(1, 'Space ID is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  status: pageStatusSchema.optional(),
  labelIds: z.array(z.string()).optional(),
  templateType: z.enum(['blank', 'example']).default('blank').optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type PageSchema = z.infer<typeof pageSchema>;
export type CreatePageSchema = z.infer<typeof createPageSchema>;
