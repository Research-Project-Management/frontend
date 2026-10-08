'use client';

/**
 * use-history.ts
 *
 * Full Backend-Connected History Hooks:
 * - Queries: Version snapshots & project historical versions from backend
 * - Mutations: Create snapshot, label version, restore version, delete label
 * - Tied directly to backend /api/v1/manuscripts/projects/:projectId/history
 *   and /api/v1/manuscripts/docs/:docId/versions.
 */

import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { versionService, historyService } from '../../coordinators/services/history.service';
import type { ProjectEvent, PageVersion } from '../../domain/types';

export const versionKeys = {
  all: ['versions'] as const,
  byPage: (pageId: string) => ['pages', 'detail', pageId, 'versions'] as const,
  byProject: (projectId: string) => ['projects', projectId, 'history', 'versions'] as const,
};

export const historyKeys = {
  byProject: (projectId: string) => ['projects', projectId, 'history', 'events'] as const,
};

export const versionsQuery = (pageId: string) =>
  queryOptions({
    queryKey: versionKeys.byPage(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return versionService.getByPageId(pageId);
    },
  });

export const historyQuery = (projectId: string) =>
  queryOptions({
    queryKey: historyKeys.byProject(projectId),
    queryFn: async (): Promise<ProjectEvent[]> => {
      if (!projectId) return [];
      return historyService.getByProjectId(projectId);
    },
  });

export const pageVersionsQueryOptions = versionsQuery;
export const projectHistoryQueryOptions = historyQuery;

export function useVersionActions() {
  const queryClient = useQueryClient();

  const saveVersion = useMutation({
    mutationFn: async (payload: {
      pageId?: string;
      projectId?: string;
      content?: string;
      label?: string;
      summary?: string;
    }) => {
      if (payload.projectId) {
        return historyService.createProjectSnapshot(payload.projectId, {
          summary: payload.summary || payload.label,
          label: payload.label,
        });
      }
      return versionService.save(payload as any);
    },
    onSuccess: (_, vars) => {
      toast.success('Version saved');
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: historyKeys.byProject(vars.projectId) });
        queryClient.invalidateQueries({ queryKey: versionKeys.byProject(vars.projectId) });
      }
      if (vars.pageId) {
        queryClient.invalidateQueries({ queryKey: versionKeys.byPage(vars.pageId) });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save version');
    },
  });

  const restoreVersion = useMutation({
    mutationFn: async (payload: {
      pageId?: string;
      versionId?: string;
      projectId?: string;
      targetVersion?: number;
    }) => {
      if (payload.projectId && payload.targetVersion) {
        return historyService.restoreProjectVersion(payload.projectId, payload.targetVersion);
      }
      if (payload.pageId && payload.versionId) {
        return versionService.restore({ pageId: payload.pageId, versionId: payload.versionId });
      }
    },
    onSuccess: (_, vars) => {
      toast.success('Version restored');
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: historyKeys.byProject(vars.projectId) });
      }
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to restore version');
    },
  });

  const updateLabel = useMutation({
    mutationFn: async (payload: {
      pageId?: string;
      versionId: string;
      label: string;
      rootPageId?: string;
      projectId?: string;
      versionNumber?: number;
    }) => {
      const pid = payload.projectId || payload.rootPageId;
      if (pid && payload.versionNumber) {
        return historyService.labelProjectVersion(pid, payload.versionNumber, payload.label);
      }
      const pageId = payload.pageId || pid || '';
      return versionService.updateLabel(pageId, payload.versionId, payload.label);
    },
    onSuccess: (_, vars) => {
      toast.success('Version label updated');
      const pid = vars.projectId || vars.rootPageId;
      if (pid) {
        queryClient.invalidateQueries({ queryKey: historyKeys.byProject(pid) });
      }
      if (vars.pageId) {
        queryClient.invalidateQueries({ queryKey: versionKeys.byPage(vars.pageId) });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update version label');
    },
  });

  const deleteVersion = useMutation({
    mutationFn: async (payload: {
      pageId?: string;
      versionId?: string;
      projectId?: string;
      labelId?: string;
    }) => {
      if (payload.projectId && payload.labelId) {
        return historyService.deleteProjectLabel(payload.projectId, payload.labelId);
      }
      if (payload.pageId && payload.versionId) {
        return versionService.delete(payload.pageId, payload.versionId);
      }
    },
    onSuccess: () => {
      toast.success('Version deleted');
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });

  return {
    saveVersion,
    restoreVersion,
    updateLabel,
    deleteVersion,
  };
}

export function useProjectHistory(projectId: string) {
  const queryClient = useQueryClient();

  const {
    data: history = [],
    isLoading,
    refetch,
  } = useQuery({
    ...historyQuery(projectId),
    enabled: Boolean(projectId),
  });

  const restoreToEvent = useMutation({
    mutationFn: async (payload: {
      rootPageId?: string;
      versionNumber?: number;
      eventId?: string;
    }) => {
      const pid = payload.rootPageId || projectId;
      const ver = payload.versionNumber;
      if (ver) {
        return historyService.restoreProjectVersion(pid, ver);
      }
      return [];
    },
    onSuccess: () => {
      toast.success('Project restored to historical version');
      queryClient.invalidateQueries({ queryKey: historyKeys.byProject(projectId) });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to restore project version');
    },
  });

  return {
    history,
    isLoading,
    refetch,
    restoreToEvent,
  };
}

export function useHistoryActions() {
  const queryClient = useQueryClient();

  const restoreToEvent = useMutation({
    mutationFn: async (payload: {
      rootPageId?: string;
      versionNumber?: number;
      eventId?: string;
    }) => {
      const pid = payload.rootPageId || '';
      const ver = payload.versionNumber;
      if (pid && ver) {
        return historyService.restoreProjectVersion(pid, ver);
      }
      return [];
    },
    onSuccess: () => {
      toast.success('Restored to historical version');
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to restore version');
    },
  });

  return {
    restoreToEvent,
  };
}

export const useProjectHistoryActions = useHistoryActions;

export const diffKeys = {
  compare: (pageId: string, fromId: string, toId: string) =>
    ['pages', pageId, 'diff', fromId, toId] as const,
};

export function useVersionDiff(
  pageId?: string | null,
  fromId?: string | null,
  toId?: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: diffKeys.compare(pageId || '', fromId || '', toId || ''),
    queryFn: async () => {
      if (!pageId || !fromId || !toId) return null;
      return versionService.compareVersions(pageId, fromId, toId);
    },
    enabled: Boolean(pageId && fromId && toId && (options?.enabled ?? true)),
    staleTime: 1000 * 60 * 30, // 30 minutes cache for immutable historical diffs
  });
}

export const projectHistoryKeys = {
  diff: (projectId: string, baseVersion: number, targetVersion: number) =>
    ['projects', projectId, 'history', 'diff', baseVersion, targetVersion] as const,
  snapshot: (projectId: string, version: number) =>
    ['projects', projectId, 'history', 'snapshot', version] as const,
};

export function useProjectDiff(
  projectId: string,
  baseVersion?: number | null,
  targetVersion?: number | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: projectHistoryKeys.diff(projectId, baseVersion || 0, targetVersion || 0),
    queryFn: async () => {
      if (!projectId || !baseVersion || !targetVersion) return null;
      return historyService.compareProjectVersions(projectId, baseVersion, targetVersion);
    },
    enabled: Boolean(projectId && baseVersion && targetVersion && (options?.enabled ?? true)),
    staleTime: 1000 * 60 * 30, // 30 minutes cache for immutable historical diffs
  });
}

export function useProjectSnapshot(
  projectId: string,
  version?: number | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: projectHistoryKeys.snapshot(projectId, version || 0),
    queryFn: async () => {
      if (!projectId || !version) return null;
      return historyService.getProjectSnapshot(projectId, version);
    },
    enabled: Boolean(projectId && version && (options?.enabled ?? true)),
    staleTime: 1000 * 60 * 30,
  });
}

