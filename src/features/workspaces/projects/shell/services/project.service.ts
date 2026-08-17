import { apiDelete, apiGet, apiPost, apiPut } from '@/shared/lib/api';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from '../types/project.types';

export type { Project, CreateProjectInput, UpdateProjectInput };

// ── Query Keys Factory ────────────────────────────────────────────────────────

export const projectKeys = {
  all: (workspaceId?: string) => (workspaceId ? ['projects', workspaceId] as const : ['projects'] as const),
  byId: (projectId: string) => ['project', projectId] as const,
  overview: (projectId: string) => ['project-overview', projectId] as const,
  header: (projectId: string) => ['project-header', projectId] as const,
  projectsHeader: (workspaceId?: string) => (workspaceId ? ['projects-header', workspaceId] as const : ['projects-header'] as const),
  members: (projectId: string) => ['project-members', projectId] as const,
};

// ── Pure HTTP API Layer ───────────────────────────────────────────────────────

export const fetchProject = (projectId: string) =>
  apiGet<{ project: Project } | Project>(`/api/project/${projectId}`);

export const fetchProjectsByWorkspaceId = (workspaceIdOrUrl: string, signal?: AbortSignal) =>
  apiGet<{ projects?: Project[]; data?: Project[] } | Project[]>(
    `/api/workspace/${workspaceIdOrUrl}/projects`,
    { signal }
  );

export const createProjectApi = (workspaceId: string, data: CreateProjectInput) =>
  apiPost<{ project?: Project; data?: Project } | Project>(
    `/api/workspace/${workspaceId}/projects`,
    data
  );

export const updateProjectApi = (projectId: string, data: Partial<UpdateProjectInput>) =>
  apiPut<{ project?: Project; data?: Project } | Project>(`/api/project/${projectId}`, data);

export const deleteProjectApi = (projectId: string) =>
  apiDelete<{ success: boolean }>(`/api/project/${projectId}`);

export const archiveProjectApi = (projectId: string) =>
  apiPut<{ project?: Project; data?: Project } | Project>(`/api/project/${projectId}`, {
    isArchived: true,
  });

export const restoreProjectApi = (projectId: string) =>
  apiPut<{ project?: Project; data?: Project } | Project>(`/api/project/${projectId}`, {
    isArchived: false,
  });

export const toggleProjectFavoriteApi = (projectId: string, isFavorite: boolean) =>
  apiPut<{ project?: Project; data?: Project } | Project>(`/api/project/${projectId}`, {
    isFavorite,
  });

export const fetchProjectMembers = (projectId: string) =>
  apiGet<{ members: any[] }>(`/api/project/${projectId}/members`);

export const addProjectMemberApi = (projectId: string, userId: string, role: string = 'contributor') =>
  apiPost(`/api/project/${projectId}/members`, { userId, role });

export const updateProjectMemberRoleApi = (projectId: string, userId: string, role: string) =>
  apiPut(`/api/project/${projectId}/members/${userId}`, { role });

export const removeProjectMemberApi = (projectId: string, userId: string) =>
  apiDelete(`/api/project/${projectId}/members/${userId}`);

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
};

// Aliases for backwards compatibility
export const createProject = createProjectApi;
export const updateProject = updateProjectApi;
export const deleteProject = deleteProjectApi;
export const archiveProject = archiveProjectApi;
export const restoreProject = restoreProjectApi;
