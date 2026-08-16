import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255, 'Folder name is too long'),
  parentId: z.string().nullable().optional(),
  projectId: z.string(), // For project-scoped storage
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const renameItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
});

export type RenameItemInput = z.infer<typeof renameItemSchema>;
