import { z } from 'zod';

export const projectRenameSchema = z.object({
  name: z.string().trim().min(1, 'Project name cannot be empty').max(150, 'Project name is too long'),
});

export type ProjectRenameInput = z.infer<typeof projectRenameSchema>;

export const projectCopySchema = z.object({
  name: z.string().trim().min(1, 'Copy name cannot be empty').max(150, 'Copy name is too long'),
});

export type ProjectCopyInput = z.infer<typeof projectCopySchema>;
