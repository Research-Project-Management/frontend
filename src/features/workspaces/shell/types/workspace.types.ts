import { z } from 'zod';
import {
  WorkspaceSchema,
  WorkspaceBaseSchema,
  CreateWorkspaceBodySchema,
  WorkspacePatchSchema,
  WorkspaceListResponseSchema,
  WorkspaceDetailResponseSchema,
  DeleteWorkspaceResultSchema,
  WorkspaceSearchItemSchema,
  ResearchScaleEnum,
} from '../schemas/workspace.schema';

export type ResearchScale = z.infer<typeof ResearchScaleEnum>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceBase = Workspace;
export type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBodySchema>;
export type WorkspacePatch = z.infer<typeof WorkspacePatchSchema>;
export type WorkspaceListResponse = z.infer<typeof WorkspaceListResponseSchema>;
export type WorkspaceDetailResponse = z.infer<typeof WorkspaceDetailResponseSchema>;
export type DeleteWorkspaceResult = z.infer<typeof DeleteWorkspaceResultSchema>;
export type WorkspaceSearchItem = z.infer<typeof WorkspaceSearchItemSchema>;

export type WorkspacesQueryData =
  | WorkspaceListResponse
  | Workspace[]
  | undefined;

export type WorkspaceDetailQueryData =
  | WorkspaceDetailResponse
  | Workspace
  | undefined;


