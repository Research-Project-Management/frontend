import { z } from 'zod';

export const DeleteWorkspaceResultSchema = z.object({
  workspaceId: z.string(),
  alreadyDeleted: z.boolean(),
});

export const WorkspacePatchSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  avatar: z.string().nullable().optional(),
  companySize: z.string().optional(),
  timezone: z.string().optional(),
  url: z.string().optional(),
});

export const WorkspaceBaseSchema = z.object({
  id: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

export const CreateWorkspaceBodySchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.string().optional(),
  avatar: z.string().nullable().optional(),
});

export const WorkspaceListResponseSchema = z.object({
  workspaces: z.array(WorkspaceBaseSchema).optional(),
}).passthrough();

export const WorkspaceDetailResponseSchema = z.object({
  workspace: WorkspaceBaseSchema.optional(),
  yourRole: z.any().optional(),
}).passthrough();
