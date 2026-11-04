'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workItemApi,
  AVAILABLE_LABEL_COLORS,
  DEFAULT_LABEL_COLOR,
} from '@/features/projects/project-id/work-items/api/work-item.api';
import {
  projectKeys,
  fetchProject,
  fetchUserProjects,
  type Project,
} from '@/features/projects/shell/services/project.service';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

export const labelKeys = {
  all: ['labels'] as const,
  project: (projectId?: string) => ['labels', 'project', projectId] as const,
  scoped: (projectId?: string, type?: string) => {
    const normalizedType = !type || type === 'work-item' ? 'work_item' : type;
    return ['labels', projectId ?? 'default', normalizedType] as const;
  },
};

export const useLabelsQuery = (
  projectId?: string,
  type?: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: labelKeys.scoped(projectId, type),
    queryFn: () =>
      workItemApi.labels.list(
        projectId,
        !type || type === 'work-item' ? 'work_item' : type,
      ),
    staleTime: 60_000,
    enabled:
      options?.enabled !== undefined ? options.enabled : Boolean(projectId),
  });

export const historyKeys = {
  activity: (id: string) => ['work-item-activity', id] as const,
};

export const useActivityLogs = (id: string) =>
  useQuery({
    queryKey: historyKeys.activity(id),
    queryFn: async () => {
      try {
        const res = await workItemApi.history.getActivityLogs(id);
        if (Array.isArray(res)) return res;
        if (res && 'activities' in res && Array.isArray(res.activities)) return res.activities;
        if (res && 'data' in res && Array.isArray(res.data)) return res.data;
        return [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(id),
  });

// ── Query Keys ──────────────────────────────────────────────────────────────
export const stateKeys = {
  all: (projectId: string) => ['project-states', projectId] as const,
  counts: (projectId: string) => ['project-state-counts', projectId] as const,
};

export const useProjectStates = (projectId: string) =>
  useQuery({
    queryKey: stateKeys.all(projectId),
    queryFn: () => workItemApi.states.getStates(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
  });

export const itemKeys = {
  all: ['work-items'] as const,
  project: (
    projectId: string,
    params?: Record<string, string | string[] | number | boolean | undefined>,
  ) =>
    params && Object.keys(params).length > 0
      ? (['work-items', projectId, params] as const)
      : (['work-items', projectId] as const),
  detail: (id: string) => ['work-item', id] as const,
  comments: (id: string) => ['comments', id] as const,
  activity: (id: string) => ['work-item-activity', id] as const,
  labels: (scope: string, type?: string, projectId?: string) => ['labels', scope, type, projectId] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

export const useProjectItems = (
  projectId: string,
  params?: Record<string, string | string[] | number | boolean | undefined>,
) =>
  useQuery({
    queryKey: itemKeys.project(projectId, params),
    queryFn: () => workItemApi.items.getProjectItems(projectId, params),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

function findCachedProject(queryClient: ReturnType<typeof useQueryClient>, projectId: string): Project | undefined {
  if (!projectId) return undefined;
  const byIdData = queryClient.getQueryData<Record<string, unknown>>(projectKeys.byId(projectId));
  if (byIdData) {
    if ('project' in byIdData && byIdData.project) return byIdData.project as Project;
    if ('id' in byIdData) return byIdData as unknown as Project;
  }
  const allData = queryClient.getQueryData<unknown>(projectKeys.all());
  if (!allData) return undefined;
  let list: Project[] = [];
  if (Array.isArray(allData)) {
    list = allData as Project[];
  } else if (typeof allData === 'object' && allData !== null) {
    const obj = allData as Record<string, unknown>;
    if (Array.isArray(obj.projects)) list = obj.projects as Project[];
    else if (typeof obj.data === 'object' && obj.data !== null && Array.isArray((obj.data as Record<string, unknown>).projects)) {
      list = (obj.data as Record<string, unknown>).projects as Project[];
    }
  }
  return list.find((p) => p.id === projectId || p.identifier === projectId || p.key === projectId);
}

export const useProjectDetails = (projectId: string) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: projectKeys.byId(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 2 * 60_000,
    placeholderData: () => {
      const cached = findCachedProject(queryClient, projectId);
      return cached ? { project: cached } : undefined;
    },
  });
};

export const useWorkspaceProjects = () =>
  useQuery({
    queryKey: projectKeys.all(),
    queryFn: async () => {
      const res = await fetchUserProjects('all');
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'projects' in res && Array.isArray((res as { projects: unknown[] }).projects)) {
        return (res as { projects: unknown[] }).projects;
      }
      return [];
    },
    enabled: true,
    staleTime: 60_000,
  });

export function prefetchProjectWorkspace(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId?: string,
) {
  if (!projectId) return;
  void queryClient.prefetchQuery({
    queryKey: projectKeys.byId(projectId),
    queryFn: () => fetchProject(projectId),
    staleTime: 2 * 60_000,
  });
  void queryClient.prefetchQuery({
    queryKey: itemKeys.project(projectId),
    queryFn: () => workItemApi.items.getProjectItems(projectId),
    staleTime: 60_000,
  });
  void queryClient.prefetchQuery({
    queryKey: stateKeys.all(projectId),
    queryFn: () => workItemApi.states.getStates(projectId),
    staleTime: 5 * 60_000,
  });
}

export function invalidateItemRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId?: string,
) {
  queryClient.invalidateQueries({ queryKey: ['work-items'] });
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-state-counts', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-overview', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-analytics-dist', projectId] });
    queryClient.invalidateQueries({ queryKey: ['work-items-analytics', projectId] });
    queryClient.invalidateQueries({ queryKey: ['work-item-cpm', projectId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['project-state-counts'] });
    queryClient.invalidateQueries({ queryKey: ['project-overview'] });
    queryClient.invalidateQueries({ queryKey: ['project-analytics-dist'] });
    queryClient.invalidateQueries({ queryKey: ['work-items-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['work-item-cpm'] });
  }
}
