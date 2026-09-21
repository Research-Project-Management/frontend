import { apiDelete, apiGet, apiPost, apiPut, apiPatch } from "@/shared/lib/api";
import type {
  Project,
  ProjectState,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectMember,
  ProjectRole,
  ProjectPermissions,
} from '../types/project.types';

export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectMember,
  ProjectRole,
  ProjectPermissions,
};

// ── Query Keys Factory ────────────────────────────────────────────────────────

export const projectKeys = {
  all: (_scopeId?: string) => ['projects', 'me'] as const,
  byId: (projectId: string) => ['project', projectId] as const,
  overview: (projectId: string) => ['project-overview', projectId] as const,
  header: (projectId: string) => ['project-header', projectId] as const,
  projectsHeader: (_scopeId?: string) => ['projects-header', 'me'] as const,
  members: (projectId: string) => ['project-members', projectId] as const,
  states: (projectId: string) => ['project-states', projectId] as const,
  currentState: (projectId: string) => ['project-current-state', projectId] as const,
  stateTemplate: () => ['project-states-template'] as const,
};

// ── Pure HTTP API Layer ───────────────────────────────────────────────────────

export const fetchProject = (projectId: string) =>
  apiGet<ProjectDetailResponse>(`/api/projects/${projectId}`);

export const fetchUserProjects = (
  filter?: 'created' | 'shared' | 'all',
  signal?: AbortSignal,
) =>
  apiGet<ProjectListResponse>(
    filter ? `/api/projects?type=${filter}` : `/api/projects`,
    { signal },
  );

export const fetchProjectsByWorkspaceId = (
  _workspaceIdOrUrl?: string,
  signal?: AbortSignal,
) =>
  fetchUserProjects('all', signal);

export function createProjectApi(
  first: CreateProjectInput | string,
  second?: CreateProjectInput | string,
): Promise<ProjectDetailResponse> {
  const payload: CreateProjectInput =
    typeof first === 'object'
      ? first
      : typeof second === 'object'
        ? second
        : ({} as CreateProjectInput);

  return apiPost<ProjectDetailResponse>(`/api/projects`, payload);
}

export const updateProjectApi = (
  projectId: string,
  data: Partial<UpdateProjectInput>,
) =>
  apiPut<ProjectDetailResponse>(`/api/projects/${projectId}`, data);

export const deleteProjectApi = (projectId: string) =>
  apiDelete<{ success: boolean; message?: string }>(`/api/projects/${projectId}`);

export const archiveProjectApi = (projectId: string) =>
  apiPatch<ProjectDetailResponse>(`/api/projects/${projectId}/archive`);

export const restoreProjectApi = (projectId: string) =>
  apiPatch<ProjectDetailResponse>(`/api/projects/${projectId}/unarchive`);

export const toggleProjectFavoriteApi = (
  projectId: string,
  _isFavorite?: boolean,
) =>
  apiPost<{ isFavorite: boolean }>(`/api/projects/${projectId}/favorite/toggle`);

export const fetchProjectMembers = (projectId: string) =>
  apiGet<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);

export const addProjectMemberApi = (
  projectId: string,
  userId: string,
  role: ProjectRole | string = 'contributor',
) =>
  apiPost(`/api/projects/${projectId}/members`, { userId, role });

export const updateProjectMemberRoleApi = (
  projectId: string,
  userId: string,
  role: ProjectRole | string,
) =>
  apiPut(`/api/projects/${projectId}/members/${userId}`, { role });

export const removeProjectMemberApi = (projectId: string, userId: string) =>
  apiDelete(`/api/projects/${projectId}/members/${userId}`);

// ── Project State API ─────────────────────────────────────────────────────────

export interface ProjectCurrentStateResponse {
  stateId: string | null;
  state: ProjectState | null;
  stateLabel: string;
}

export interface CreateProjectStateInput {
  name: string;
  color?: string;
  description?: string;
  sequence?: number;
}

export interface UpdateProjectStateItemInput {
  name?: string;
  color?: string;
  description?: string;
  sequence?: number;
}

export const fetchProjectStates = (projectId: string) =>
  apiGet<ProjectState[]>(`/api/v1/projects/${projectId}/settings/states`);

export const fetchProjectCurrentState = (projectId: string) =>
  apiGet<ProjectCurrentStateResponse>(`/api/v1/projects/${projectId}/settings/state`);

export const transitionProjectStateApi = (projectId: string, stateId: string | null) =>
  apiPatch<ProjectCurrentStateResponse>(`/api/v1/projects/${projectId}/settings/state`, { stateId });

export const createProjectStateApi = (projectId: string, data: CreateProjectStateInput) =>
  apiPost<ProjectState>(`/api/v1/projects/${projectId}/settings/states`, data);

export const updateProjectStateItemApi = (
  projectId: string,
  stateId: string,
  data: UpdateProjectStateItemInput,
) =>
  apiPatch<ProjectState>(`/api/v1/projects/${projectId}/settings/states/${stateId}`, data);

export const reorderProjectStatesApi = (
  projectId: string,
  states: Array<{ id: string; sequence: number }>,
) =>
  apiPut<ProjectState[]>(`/api/v1/projects/${projectId}/settings/states/reorder`, { states });

export const deleteProjectStateApi = (
  projectId: string,
  stateId: string,
  fallbackStateId?: string,
) =>
  apiDelete<{ success: boolean; deletedId: string }>(
    `/api/v1/projects/${projectId}/settings/states/${stateId}${
      fallbackStateId ? `?fallbackStateId=${fallbackStateId}` : ''
    }`,
  );

export const fetchDefaultStatesTemplate = () =>
  apiGet<Array<{ name: string; description: string; color: string; sequence: number; isDefault: boolean }>>(
    `/api/v1/projects/settings/states/default-template`,
  );

// ── Structured Project Service Object ─────────────────────────────────────────

export const ProjectService = {
  getAll: fetchProjectsByWorkspaceId,
  getById: fetchProject,
  create: createProjectApi,
  update: updateProjectApi,
  delete: deleteProjectApi,
  archive: archiveProjectApi,
  restore: restoreProjectApi,
  toggleFavorite: toggleProjectFavoriteApi,
  getMembers: fetchProjectMembers,
  addMember: addProjectMemberApi,
  updateMemberRole: updateProjectMemberRoleApi,
  removeMember: removeProjectMemberApi,
  // Project Dynamic States
  getStates: fetchProjectStates,
  getCurrentState: fetchProjectCurrentState,
  transitionState: transitionProjectStateApi,
  createState: createProjectStateApi,
  updateStateItem: updateProjectStateItemApi,
  reorderStates: reorderProjectStatesApi,
  deleteState: deleteProjectStateApi,
  getDefaultStatesTemplate: fetchDefaultStatesTemplate,
};

// Backwards compatibility aliases
export const createProject = createProjectApi;
export const updateProject = updateProjectApi;
export const deleteProject = deleteProjectApi;
export const archiveProject = archiveProjectApi;
export const restoreProject = restoreProjectApi;
export const addProjectMember = addProjectMemberApi;
export const updateProjectMemberRole = updateProjectMemberRoleApi;
export const removeProjectMember = removeProjectMemberApi;

// ── Duplicate, Trash & Permanent Delete ────────────────────────────────────────

export const duplicateProjectApi = (projectId: string) =>
  apiPost<ProjectDetailResponse>(`/api/projects/${projectId}/duplicate`, {});

export const fetchTrashedProjects = (signal?: AbortSignal) =>
  apiGet<ProjectListResponse>(`/api/projects/trash`, { signal });

export const permanentDeleteProjectApi = (projectId: string) =>
  apiDelete<{ message: string }>(`/api/projects/${projectId}/permanent`);
