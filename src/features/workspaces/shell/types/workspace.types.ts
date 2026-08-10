import { z } from 'zod';
import {
  DeleteWorkspaceResultSchema,
  WorkspacePatchSchema,
  CreateWorkspaceBodySchema,
  WorkspaceListResponseSchema,
  WorkspaceDetailResponseSchema,
  WorkspaceBaseSchema,
} from '../schemas/workspace.schema';

export type DeleteWorkspaceResult = z.infer<typeof DeleteWorkspaceResultSchema>;
export type WorkspacePatch = z.infer<typeof WorkspacePatchSchema>;
export type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBodySchema>;
export type WorkspaceListResponse = z.infer<typeof WorkspaceListResponseSchema>;
export type WorkspaceDetailResponse = z.infer<typeof WorkspaceDetailResponseSchema>;
export type WorkspaceBase = z.infer<typeof WorkspaceBaseSchema>;

export type WorkspacesQueryData =
  | WorkspaceListResponse
  | WorkspaceBase[]
  | undefined;

export type WorkspaceDetailQueryData =
  | WorkspaceDetailResponse
  | WorkspaceBase
  | undefined;
