/**
 * core.types.ts
 *
 * Core document & page domain models, validation schemas, and inferred DTOs.
 * Matches backend document/page module.
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

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type PageId = Brand<string, 'PageId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type FileId = Brand<string, 'FileId'>;

export type DocumentContent =
  | string
  | {
      source?: string;
      text?: string;
      content?: string;
    };

export type PageStatus = 'draft' | 'published' | 'archived';

export interface PageAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface PageProjectContext {
  id: string;
  name: string;
}

export interface Page {
  id: string;
  title: string;
  content: DocumentContent; // LaTeX source text or JSON structure
  status: PageStatus;
  projectId: string | PageProjectContext;
  author: PageAuthor;
  views: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  /** Null = top-level page-project. Populated = this is a file inside a page-project. */
  parentPage?: string | null;
  /** The child page designated as the main entry point (for compilation & thumbnail). Can be a full Page object when populated. */
  mainFile?: string | Page | null;
  /** Base64 JPEG data URL of the first page of the last successful PDF build. */
  pdfThumbnail?: string | null;
}

export interface PageFile {
  id: string;
  title: string;
  content?: string;
  pageId: string;
  projectId?: string | PageProjectContext;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}
