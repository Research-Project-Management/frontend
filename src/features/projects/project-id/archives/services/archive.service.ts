import { apiGet, apiPost } from '@/shared/lib/api';
import type { ProjectScopedArchivesResponse } from '../types/archive.types';

export const projectArchiveKeys = {
  all: (projectId: string) => ['project-archives', projectId] as const,
  filtered: (projectId: string, search?: string) =>
    ['project-archives', projectId, search || ''] as const,
};

export const ProjectArchiveService = {
  getProjectArchives: (
    projectId: string,
    search?: string,
    signal?: AbortSignal,
  ): Promise<ProjectScopedArchivesResponse> => {
    const params: Record<string, string> = {};
    if (search && search.trim()) {
      params.search = search.trim();
    }
    return apiGet<ProjectScopedArchivesResponse>(
      `/api/v1/projects/${projectId}/archives`,
      { params, signal },
    );
  },

  restoreItems: (
    projectId: string,
    payload: { workItemIds?: string[]; pageIds?: string[] },
  ): Promise<{
    success: boolean;
    restoredWorkItems: number;
    restoredPages: number;
    message: string;
  }> =>
    apiPost(`/api/v1/projects/${projectId}/archives/restore`, payload),
};
