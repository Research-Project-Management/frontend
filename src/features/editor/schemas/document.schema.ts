/**
 * document.schema.ts
 *
 * Zod Schemas and inferred TypeScript types for Document & File operations.
 * Single source of truth for validation and react-hook-form resolvers.
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

export const createSnapshotSchema = z.object({
  label: z.string().trim().max(100, 'Label too long').optional(),
});

export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;
