/**
 * core.schema.ts
 *
 * Zod validation schemas and inferred types for Core Document & File operations.
 * Matches backend document/core module DTOs.
 */

import { z } from 'zod';

export const createFileSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .refine((name) => !name.includes('\\'), 'Backslashes are not allowed in file names'),
  content: z.string().optional(),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name is too long'),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const renameItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name is too long'),
});

export type RenameItemInput = z.infer<typeof renameItemSchema>;

export const createPageSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Page title is required')
    .max(255, 'Page title is too long'),
  slug: z.string().trim().optional(),
  icon: z.string().optional(),
  coverImage: z.string().url().optional(),
  rank: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
  isLocked: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  content: z.any().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  projectId: z.string().optional(),
  parentPageId: z.string().optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
  slug: z.string().trim().optional(),
  icon: z.string().optional(),
  coverImage: z.string().url().optional(),
  rank: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
  isLocked: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  content: z.any().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  parentPageId: z.string().optional(),
  mainFileId: z.string().optional(),
  pdfThumbnail: z.string().optional(),
});

export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export const setMainFileSchema = z.object({
  mainFileId: z.string().min(1, 'Main file ID is required'),
});

export type SetMainFileInput = z.infer<typeof setMainFileSchema>;

export const updateThumbnailSchema = z.object({
  pdfThumbnail: z.string().min(1, 'Thumbnail data is required'),
});

export type UpdateThumbnailInput = z.infer<typeof updateThumbnailSchema>;
