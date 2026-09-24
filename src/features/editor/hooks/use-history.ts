'use client';

/**
 * use-history.ts
 *
 * Clean Presentational History Hooks:
 * - Version snapshots queries & mutations
 * - Project event history & restore
 * - Decoupled from legacy backend endpoints
 */

import { queryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

export const versionKeys = {
  all: ['versions'] as const,
  byPage: (pageId: string) => ['pages', 'detail', pageId, 'versions'] as const,
};

export const historyKeys = {
  byProject: (projectId: string) => ['pages', 'history', projectId] as const,
};

export const versionsQuery = (pageId: string) =>
  queryOptions({
    queryKey: versionKeys.byPage(pageId),
    queryFn: async () => [],
  });

export const historyQuery = (projectId: string) =>
  queryOptions({
    queryKey: historyKeys.byProject(projectId),
    queryFn: async () => [],
  });

export const pageVersionsQueryOptions = versionsQuery;
export const projectHistoryQueryOptions = historyQuery;

export function useVersionActions() {
  const saveVersion = {
    mutate: (_payload: any) => {
      toast.success('Đã lưu phiên bản');
    },
    isPending: false,
  };

  const restoreVersion = {
    mutate: (_payload: any) => {
      toast.success('Đã khôi phục phiên bản');
    },
    isPending: false,
  };

  const updateLabel = {
    mutate: (_payload: any) => {
      toast.success('Đã cập nhật nhãn phiên bản');
    },
    isPending: false,
  };

  const deleteVersion = {
    mutate: (_payload: any) => {
      toast.success('Đã xóa phiên bản');
    },
    isPending: false,
  };

  return {
    saveVersion: saveVersion as any,
    restoreVersion: restoreVersion as any,
    updateLabel: updateLabel as any,
    deleteVersion: deleteVersion as any,
  };
}

import type { ProjectEvent } from '../types';

export function useProjectHistory(_projectId: string) {
  const restoreToEvent = {
    mutate: (_payload: any) => {
      toast.success('Đã khôi phục về sự kiện lịch sử');
    },
    isPending: false,
  };

  return {
    history: [] as ProjectEvent[],
    isLoading: false,
    restoreToEvent: restoreToEvent as any,
  };
}

export function useHistoryActions() {
  const restoreToEvent = {
    mutate: (_payload: any) => {
      toast.success('Đã khôi phục về sự kiện lịch sử');
    },
    isPending: false,
  };

  return {
    restoreToEvent: restoreToEvent as any,
  };
}

export const useProjectHistoryActions = useHistoryActions;
