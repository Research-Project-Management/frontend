import { apiDelete, apiGet, apiPost, apiPut, apiPatch } from "@/shared/lib/api";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectMember,
  ProjectRole,
} from '../types/project.types';

export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectMember,
  ProjectRole,
};

// ── Query Keys Factory ────────────────────────────────────────────────────────

export const projectKeys = {
  all: (workspaceId?: string) =>
    workspaceId ? (['projects', workspaceId] as const) : (['projects', 'me'] as const),
  byId: (projectId: string) => ['project', projectId] as const,
  overview: (projectId: string) => ['project-overview', projectId] as const,
  header: (projectId: string) => ['project-header', projectId] as const,
  projectsHeader: (workspaceId?: string) =>
    workspaceId
      ? (['projects-header', workspaceId] as const)
      : (['projects-header', 'me'] as const),
  members: (projectId: string) => ['project-members', projectId] as const,
};

// ── Pure HTTP API Layer ───────────────────────────────────────────────────────

export const fetchProject = (projectId: string) =>
  apiGet<ProjectDetailResponse | { project: Project } | Project>(
    `/api/project/${projectId}`,
  );

export const fetchUserProjects = (
  filter?: 'created' | 'shared' | 'all',
  signal?: AbortSignal,
) =>
  apiGet<ProjectListResponse | { projects?: Project[]; myProjects?: Project[]; sharedProjects?: Project[]; data?: Project[] } | Project[]>(
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
): Promise<ProjectDetailResponse | { project?: Project; data?: Project } | Project> {
  const payload: CreateProjectInput =
    typeof first === 'object'
      ? first
      : typeof second === 'object'
        ? second
        : ({} as CreateProjectInput);

  return apiPost<ProjectDetailResponse | { project?: Project; data?: Project } | Project>(
    `/api/projects`,
    payload,
  );
}

export const updateProjectApi = (
  projectId: string,
  data: Partial<UpdateProjectInput>,
) =>
  apiPut<ProjectDetailResponse | { project?: Project; data?: Project } | Project>(
    `/api/project/${projectId}`,
    data,
  );

export const deleteProjectApi = (projectId: string) =>
  apiDelete<{ success: boolean; message?: string }>(`/api/project/${projectId}`);

export const archiveProjectApi = (projectId: string) =>
  apiPatch<ProjectDetailResponse | { project?: Project } | Project>(
    `/api/project/${projectId}/archive`,
  );

export const restoreProjectApi = (projectId: string) =>
  apiPatch<ProjectDetailResponse | { project?: Project } | Project>(
    `/api/project/${projectId}/unarchive`,
  );

export const toggleProjectFavoriteApi = (
  projectId: string,
  isFavorite: boolean,
) =>
  apiPut<ProjectDetailResponse | { project?: Project; data?: Project } | Project>(
    `/api/project/${projectId}`,
    { isFavorite },
  );

export const fetchProjectMembers = (projectId: string) =>
  apiGet<{ members: ProjectMember[] }>(`/api/project/${projectId}/members`);

export const addProjectMemberApi = (
  projectId: string,
  userId: string,
  role: ProjectRole | string = 'contributor',
) =>
  apiPost(`/api/project/${projectId}/members`, { userId, role });

export const updateProjectMemberRoleApi = (
  projectId: string,
  userId: string,
  role: ProjectRole | string,
) =>
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

// Backwards compatibility aliases
export const createProject = createProjectApi;
export const updateProject = updateProjectApi;
export const deleteProject = deleteProjectApi;
export const archiveProject = archiveProjectApi;
export const restoreProject = restoreProjectApi;

