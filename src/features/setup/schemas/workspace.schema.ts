import { z } from 'zod';

// ─── Workspace Schema ─────────────────────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(80),
  url: z
    .string()
    .min(1, 'URL slug is required')
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  avatar: z.string().nullable().optional(),
  size: z.string().min(1, 'Please select a range').optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(80).optional(),
  avatar: z.string().nullable().optional(),
});

export type CreateWorkspaceSchema = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceSchema = z.infer<typeof updateWorkspaceSchema>;
