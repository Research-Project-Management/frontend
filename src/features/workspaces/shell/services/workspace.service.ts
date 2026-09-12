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

export const DEFAULT_WORKSPACE: Workspace = {
  id: 'flux',
  name: 'Flux',
  slug: 'flux',
  url: 'flux',
  avatar: '',
  plan: 'free',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Pure User-Centric Adaptation Layer ────────────────────────────────────────
// Workspaces are decoupled from business logic; users operate in their personal workbench.

export const fetchAllWorkspaces = async (signal?: AbortSignal): Promise<WorkspaceListResponse> => {
  try {
    const res = await apiGet<{ user?: any }>('/api/users/me', { signal });
    const user = res?.user;
    if (!user) return { workspaces: [DEFAULT_WORKSPACE] };
    const userWorkspace: Workspace = {
      id: user.id || 'flux',
      name: user.name || 'Flux',
      slug: 'flux',
      url: 'flux',
      avatar: user.avatar || '',
      plan: 'free',
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
    } as Workspace;
    return { workspaces: [userWorkspace] };
  } catch {
    return { workspaces: [DEFAULT_WORKSPACE] };
  }
};

export const fetchWorkspaceById = async (
  _id?: string,
  signal?: AbortSignal,
): Promise<WorkspaceDetailResponse> => {
  try {
    const res = await apiGet<{ user?: any }>('/api/users/me', { signal });
    const user = res?.user;
    if (!user) return { workspace: DEFAULT_WORKSPACE, yourRole: 'owner' };
    const userWorkspace: Workspace = {
      id: user?.id || 'flux',
      name: user?.name || 'Flux',
      slug: 'flux',
      url: 'flux',
      avatar: user?.avatar || '',
      plan: 'free',
      createdAt: user?.createdAt || new Date().toISOString(),
      updatedAt: user?.updatedAt || new Date().toISOString(),
    } as Workspace;
    return { workspace: userWorkspace, yourRole: 'owner' };
  } catch {
    return {
      workspace: DEFAULT_WORKSPACE,
      yourRole: 'owner',
    };
  }
};

export const createWorkspace = async (_data: CreateWorkspaceBody): Promise<WorkspaceDetailResponse> => {
  return fetchWorkspaceById('flux');
};

export const updateWorkspaceById = async (
  _id: string,
  data: WorkspacePatch,
): Promise<WorkspaceDetailResponse> => {
  try {
    await apiPut('/api/users/settings', {
      name: (data as any).name,
      avatar: (data as any).avatar,
      settings: data,
    });
  } catch {
    // Graceful fallback
  }
  return fetchWorkspaceById('flux');
};

export const deleteWorkspaceById = async (
  id: string,
): Promise<DeleteWorkspaceResult> => {
  return { workspaceId: id, alreadyDeleted: true };
};

// ── Structured Service Object ─────────────────────────────────────────────────

export const WorkspaceService = {
  getAll: fetchAllWorkspaces,
  getById: fetchWorkspaceById,
  create: createWorkspace,
  update: updateWorkspaceById,
  delete: deleteWorkspaceById,
};
