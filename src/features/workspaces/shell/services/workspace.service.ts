import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/shared/lib/api';
import type { QueryClient } from '@tanstack/react-query';
import type { WorkspacePatch, DeleteWorkspaceResult } from '../types/workspace.types';

// ── Internal cache helpers ────────────────────────────────────────────────────

type WorkspacesQueryData =
  | { workspaces?: Array<{ _id?: string }> }
  | Array<{ _id?: string }>
  | undefined;

type WorkspaceDetailQueryData =
  | { workspace?: { _id?: string; url?: string } }
  | { _id?: string; url?: string }
  | undefined;

const mergeWorkspace = (current: any, patch: WorkspacePatch) => ({
  ...current,
  ...patch,
});

const removeFromList = (current: WorkspacesQueryData, workspaceId: string) => {
  if (Array.isArray(current)) {
    return current.filter((w) => w?._id !== workspaceId);
  }
  if (Array.isArray(current?.workspaces)) {
    return {
      ...current,
      workspaces: current.workspaces.filter((w) => w?._id !== workspaceId),
    };
  }
  return current;
};

const patchInList = (current: WorkspacesQueryData, patch: WorkspacePatch) => {
  if (!patch._id) return current;
  if (Array.isArray(current)) {
    return current.map((w) =>
      w?._id === patch._id ? mergeWorkspace(w, patch) : w,
    );
  }
  if (Array.isArray(current?.workspaces)) {
    return {
      ...current,
      workspaces: current.workspaces.map((w) =>
        w?._id === patch._id ? mergeWorkspace(w, patch) : w,
      ),
    };
  }
  return current;
};

export const removeWorkspaceFromWorkspacesCache = (
  queryClient: QueryClient,
  workspaceId: string,
) => {
  queryClient.setQueriesData(
    { queryKey: ['workspaces'] },
    (current: WorkspacesQueryData) => removeFromList(current, workspaceId),
  );
};

export const syncWorkspaceIntoCaches = (
  queryClient: QueryClient,
  workspacePatch: WorkspacePatch,
) => {
  if (!workspacePatch._id) return;

  queryClient.setQueriesData(
    { queryKey: ['workspaces'] },
    (current: WorkspacesQueryData) => patchInList(current, workspacePatch),
  );

  queryClient.setQueriesData(
    { queryKey: ['workspace'] },
    (current: WorkspaceDetailQueryData) => {
      if (!current) return current;
      if (
        'workspace' in current &&
        current.workspace?._id === workspacePatch._id
      ) {
        return {
          ...current,
          workspace: mergeWorkspace(current.workspace, workspacePatch),
        };
      }
      if ('_id' in current && current._id === workspacePatch._id) {
        return mergeWorkspace(current, workspacePatch);
      }
      return current;
    },
  );
};

// ── Raw fetchers (no React hooks) ─────────────────────────────────────────────

export const fetchAllWorkspaces = (signal?: AbortSignal) =>
  apiGet('/api/workspace', { signal });

export const createWorkspace = (data: {
  name: string;
  url: string;
  size?: string;
  avatar?: string | null;
}) => apiPost<{ workspace: any }>('/api/workspace', data);

export const fetchWorkspaceById = (
  workspaceIdOrUrl: string,
  signal?: AbortSignal,
) => apiGet(`/api/workspace/${workspaceIdOrUrl}`, { signal });

export const fetchProjectsByWorkspaceId = (
  workspaceIdOrUrl: string,
  signal?: AbortSignal,
) => apiGet(`/api/workspace/${workspaceIdOrUrl}/projects`, { signal });

export const fetchProjectById = (projectId: string, signal?: AbortSignal) =>
  apiGet(`/api/project/${projectId}`, { signal });

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

export const updateWorkspaceById = (
  id: string,
  data: Partial<{
    name: string;
    avatar: string | null;
    companySize: string;
    timezone: string;
    url: string;
  }>,
) => apiPut(`/api/workspace/${id}`, data);

export const addWorkspaceMember = (
  workspaceId: string,
  userId: string,
  role = 'member',
) => apiPut(`/api/workspace/${workspaceId}/add-member`, { userId, role });

export const updateWorkspaceMemberRole = (
  workspaceId: string,
  userId: string,
  newRole: string,
) =>
  apiPut(`/api/workspace/${workspaceId}/update-member-role`, {
    userId,
    newRole,
  });

export const removeWorkspaceMember = (workspaceId: string, userId: string) =>
  apiPut(`/api/workspace/${workspaceId}/remove-member`, { userId });
