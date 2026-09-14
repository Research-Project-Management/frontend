import { z } from 'zod';
import {
  WorkspaceSchema,
  WorkspaceBaseSchema,
  WorkspaceListResponseSchema,
  WorkspaceDetailResponseSchema,
  WorkspaceSearchItemSchema,
} from '../schemas/workspace.schema';

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceBase = Workspace;
export type WorkspaceListResponse = z.infer<typeof WorkspaceListResponseSchema>;
export type WorkspaceDetailResponse = z.infer<typeof WorkspaceDetailResponseSchema>;
export type WorkspaceSearchItem = z.infer<typeof WorkspaceSearchItemSchema>;

export type WorkspacesQueryData =
  | WorkspaceListResponse
  | Workspace[]
  | undefined;

export type WorkspaceDetailQueryData =
  | WorkspaceDetailResponse
  | Workspace
  | undefined;


