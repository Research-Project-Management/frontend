import { apiGet, apiPut } from "@/shared/lib/api";
import type {
  Workspace,
  WorkspaceListResponse,
  WorkspaceDetailResponse,
  CreateWorkspaceBody,
  WorkspacePatch,
  DeleteWorkspaceResult,
} from '../types/workspace.types';

export type {
  Workspace,
  WorkspaceListResponse,
  WorkspaceDetailResponse,
  CreateWorkspaceBody,
  WorkspacePatch,
  DeleteWorkspaceResult,
};

// ── Query Keys Factory ────────────────────────────────────────────────────────

export const workspaceKeys = {
  all: ['user-workspace-context'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...workspaceKeys.lists(), filters] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (idOrUrl: string) => [...workspaceKeys.details(), idOrUrl] as const,
};

// ── Pure User-Centric Adaptation Layer ────────────────────────────────────────
// Workspaces are completely dissolved. Frontend reads current user profile and settings.

export const fetchAllWorkspaces = async (signal?: AbortSignal): Promise<WorkspaceListResponse> => {
  try {
    const res = await apiGet<{ user?: any }>('/api/users/me', { signal });
    const user = res?.user;
    if (!user) return { workspaces: [] };
    const userWorkspace: Workspace = {
      id: user.id,
      name: user.name || 'Personal',
      slug: 'personal',
      url: 'personal',
      avatar: user.avatar || '',
      plan: 'free',
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
    } as Workspace;
    return { workspaces: [userWorkspace] };
  } catch {
    return { workspaces: [] };
  }
};

export const fetchWorkspaceById = async (
  _workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspaceDetailResponse> => {
  try {
    const res = await apiGet<{ user?: any }>('/api/users/me', { signal });
    const user = res?.user;
    const userWorkspace: Workspace = {
      id: user?.id || 'personal',
      name: user?.name || 'Personal',
      slug: 'personal',
      url: 'personal',
      avatar: user?.avatar || '',
      plan: 'free',
      createdAt: user?.createdAt || new Date().toISOString(),
      updatedAt: user?.updatedAt || new Date().toISOString(),
    } as Workspace;
    return { workspace: userWorkspace, yourRole: 'owner' };
  } catch {
    return {
      workspace: {
        id: 'personal',
        name: 'Personal',
        slug: 'personal',
        url: 'personal',
      } as Workspace,
      yourRole: 'owner',
    };
  }
};

export const createWorkspace = async (_data: CreateWorkspaceBody): Promise<WorkspaceDetailResponse> => {
  return fetchWorkspaceById('personal');
};

export const updateWorkspaceById = async (
  _workspaceId: string,
  data: WorkspacePatch,
): Promise<WorkspaceDetailResponse> => {
  await apiPut('/api/users/settings', { settings: data });
  return fetchWorkspaceById('personal');
};

export const deleteWorkspaceById = async (
  workspaceId: string,
): Promise<DeleteWorkspaceResult> => {
  return { workspaceId, alreadyDeleted: true };
};

// ── Structured Service Object ─────────────────────────────────────────────────

export const WorkspaceService = {
  getAll: fetchAllWorkspaces,
  getById: fetchWorkspaceById,
  create: createWorkspace,
  update: updateWorkspaceById,
  delete: deleteWorkspaceById,
};
