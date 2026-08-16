import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/shared/lib/api';
import type { Workspace } from '@/features/setup/types/workspace.types';


// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkspaceListResponse = {
  workspaces: Workspace[];
};

export type WorkspaceDetailResponse = {
  workspace: Workspace;
  yourRole?: string;
};

export type CreateWorkspaceBody = {
  name: string;
  url: string;
  size?: string;
  avatar?: string | null;
};

export type WorkspacePatch = Partial<{
  name: string;
  avatar: string | null;
  companySize: string;
  timezone: string;
  url: string;
}>;

export type DeleteWorkspaceResult = {
  workspaceId: string;
  alreadyDeleted: boolean;
};

// ── Services ──────────────────────────────────────────────────────────────────

export const fetchAllWorkspaces = (signal?: AbortSignal) =>
  apiGet<WorkspaceListResponse>('/api/workspace', { signal });

export const fetchWorkspaceById = (workspaceId: string, signal?: AbortSignal) =>
  apiGet<WorkspaceDetailResponse>(`/api/workspace/${workspaceId}`, { signal });

export const createWorkspace = (data: CreateWorkspaceBody) =>
  apiPost<WorkspaceDetailResponse>('/api/workspace', data);

export const updateWorkspaceById = (workspaceId: string, data: WorkspacePatch) =>
  apiPut<WorkspaceDetailResponse>(`/api/workspace/${workspaceId}`, data);

export const deleteWorkspaceById = async (
  workspaceId: string,
): Promise<DeleteWorkspaceResult> => {
  try {
    await apiDelete(`/api/workspace/${workspaceId}`);
    return { workspaceId, alreadyDeleted: false };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { workspaceId, alreadyDeleted: true };
    }
    throw error;
  }
};
