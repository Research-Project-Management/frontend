import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type { ProjectLabelItem } from '../types/project.types';

export interface ProjectLabel extends ProjectLabelItem {
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectLabelInput {
  name: string;
  color: string;
  description?: string;
}

export interface UpdateProjectLabelInput {
  name?: string;
  color?: string;
  description?: string;
}

// ── Query Keys Factory ────────────────────────────────────────────────────────

export const projectLabelKeys = {
  all: () => ['project-labels'] as const,
  userLabels: () => ['project-labels', 'user'] as const,
  byProject: (projectId: string) => ['project-labels', 'project', projectId] as const,
};

// ── Pure HTTP API Layer ───────────────────────────────────────────────────────

/**
 * List all project labels created by the current user.
 */
export async function getUserProjectLabels(signal?: AbortSignal): Promise<ProjectLabel[]> {
  const result = await apiGet<ProjectLabel[]>('/api/project-labels', { signal });
  return Array.isArray(result) ? result : [];
}

/**
 * Create a new project label/tag.
 */
export async function createProjectLabel(
  dto: CreateProjectLabelInput,
  signal?: AbortSignal
): Promise<ProjectLabel> {
  return apiPost<ProjectLabel>('/api/project-labels', dto, { signal });
}

/**
 * Update an existing project label.
 */
export async function updateProjectLabel(
  id: string,
  dto: UpdateProjectLabelInput,
  signal?: AbortSignal
): Promise<ProjectLabel> {
  return apiPatch<ProjectLabel>(`/api/project-labels/${id}`, dto, { signal });
}

/**
 * Delete a project label by ID.
 */
export async function deleteProjectLabel(
  id: string,
  signal?: AbortSignal
): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/project-labels/${id}`, { signal });
}

/**
 * Get labels currently assigned to a specific project.
 */
export async function getProjectAssignedLabels(
  projectId: string,
  signal?: AbortSignal
): Promise<ProjectLabel[]> {
  const result = await apiGet<ProjectLabel[]>(`/api/projects/${projectId}/project-labels`, { signal });
  return Array.isArray(result) ? result : [];
}

/**
 * Assign / update labels for a project.
 */
export async function assignLabelsToProject(
  projectId: string,
  labelIds: string[],
  signal?: AbortSignal
): Promise<ProjectLabel[]> {
  return apiPost<ProjectLabel[]>(
    `/api/projects/${projectId}/project-labels`,
    { labelIds },
    { signal }
  );
}

/**
 * Remove a specific label from a project.
 */
export async function removeLabelFromProject(
  projectId: string,
  labelId: string,
  signal?: AbortSignal
): Promise<ProjectLabel[]> {
  return apiDelete<ProjectLabel[]>(
    `/api/projects/${projectId}/project-labels/${labelId}`,
    { signal }
  );
}
