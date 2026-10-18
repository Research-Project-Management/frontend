'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CoreService, StateService } from '@/features/projects/project-id/work-items/api/work-item.api';
import {
  projectKeys,
  fetchProject,
  fetchUserProjects,
} from '@/features/projects/shell/services/project.service';

// ── Query Keys ──────────────────────────────────────────────────────────────
export const stateKeys = {
  all: (projectId: string) => ['project-states', projectId] as const,
  counts: (projectId: string) => ['project-state-counts', projectId] as const,
};

export const useProjectStates = (projectId: string) =>
  useQuery({
    queryKey: stateKeys.all(projectId),
    queryFn: () => StateService.getStates(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

export const itemKeys = {
  all: ['work-items'] as const,
  project: (projectId: string) => ['work-items', projectId] as const,
  comments: (id: string) => ['work-item-comments', id] as const,
  activity: (id: string) => ['work-item-activity', id] as const,
  labels: (scope: string, type?: string, projectId?: string) => ['labels', scope, type, projectId] as const,
};

export const workItemKeys = itemKeys;

// ── Queries ─────────────────────────────────────────────────────────────────

export const useProjectItems = (projectId: string) =>
  useQuery({
    queryKey: itemKeys.project(projectId),
    queryFn: () => CoreService.getProjectItems(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

export const useProjectWorkItems = useProjectItems;

export const useAllItems = () =>
  useQuery({
    queryKey: itemKeys.all,
    queryFn: () => CoreService.getItems(),
    enabled: true,
  });

export const useProjectDetails = (projectId: string) =>
  useQuery({
    queryKey: ['project-details', projectId],
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

export const useWorkspaceProjects = () =>
  useQuery({
    queryKey: projectKeys.all('all'),
    queryFn: async () => {
      const res = await fetchUserProjects('all');
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'projects' in res && Array.isArray((res as { projects: unknown[] }).projects)) {
        return (res as { projects: unknown[] }).projects;
      }
      return [];
    },
    enabled: true,
  });

export function invalidateWorkItemRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId?: string,
) {
  queryClient.invalidateQueries({ queryKey: ['work-items'] });
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-states', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-state-counts', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-details', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-overview', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-analytics-dist', projectId] });
    queryClient.invalidateQueries({ queryKey: ['work-items-analytics', projectId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['project-states'] });
    queryClient.invalidateQueries({ queryKey: ['project-state-counts'] });
    queryClient.invalidateQueries({ queryKey: ['project-details'] });
    queryClient.invalidateQueries({ queryKey: ['project-overview'] });
    queryClient.invalidateQueries({ queryKey: ['project-analytics-dist'] });
    queryClient.invalidateQueries({ queryKey: ['work-items-analytics'] });
  }
}
