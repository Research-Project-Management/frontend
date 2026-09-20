'use client';

/**
 * use-history.ts
 *
 * Frontend hooks mirroring Backend `modules/document/history/`:
 *  - Version snapshots queries & mutations
 *  - Project event history & restore
 */

import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import { versionService, historyService } from '../services/history.service';
import { pageKeys } from './use-core';
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
    queryFn: () => versionService.getByPageId(pageId),
  });

export const historyQuery = (projectId: string) =>
  queryOptions({
    queryKey: historyKeys.byProject(projectId),
    queryFn: () => historyService.getByProjectId(projectId),
  });

export const pageVersionsQueryOptions = versionsQuery;
export const projectHistoryQueryOptions = historyQuery;

export function useVersionActions() {
  const queryClient = useQueryClient();

  const saveVersion = useMutation({
    mutationFn: (payload: {
      pageId: string;
      label?: string;
      content?: string;
      eventType?: string;
      fileName?: string;
      rootPageId?: string;
    }) => versionService.save(payload),
    onSuccess: (newVersion, { pageId, rootPageId }) => {
      queryClient.invalidateQueries({ queryKey: versionKeys.byPage(pageId) });
      if (rootPageId) {
        queryClient.invalidateQueries({ queryKey: historyKeys.byProject(rootPageId) });
      }
      toast.success('Đã lưu phiên bản');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi lưu phiên bản');
    },
  });

  const restoreVersion = useMutation({
    mutationFn: (payload: { pageId: string; versionId: string }) =>
      versionService.restore(payload),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
      queryClient.invalidateQueries({ queryKey: versionKeys.byPage(pageId) });
      toast.success('Đã khôi phục phiên bản');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi khôi phục phiên bản');
    },
  });

  const updateLabel = useMutation({
    mutationFn: (payload: {
      pageId: string;
      versionId: string;
      label: string;
      title?: string;
      rootPageId?: string;
    }) =>
      versionService.updateLabel(
        payload.pageId,
        payload.versionId,
        payload.label,
        payload.title,
      ),
    onSuccess: (_, { pageId, rootPageId }) => {
      queryClient.invalidateQueries({ queryKey: versionKeys.byPage(pageId) });
      if (rootPageId) {
        queryClient.invalidateQueries({ queryKey: historyKeys.byProject(rootPageId) });
      }
      toast.success('Đã cập nhật nhãn phiên bản');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi cập nhật nhãn phiên bản');
    },
  });

  const deleteVersion = useMutation({
    mutationFn: (payload: { pageId: string; versionId: string }) =>
      versionService.delete(payload.pageId, payload.versionId),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: versionKeys.byPage(pageId) });
      toast.success('Đã xóa phiên bản');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi xóa phiên bản');
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

  const { data: history = [], isLoading } = useQuery({
    ...historyQuery(projectId),
    enabled: !!projectId,
  });

  const restoreToEvent = useMutation({
    mutationFn: ({ rootPageId, eventId }: { rootPageId: string; eventId: string }) =>
      historyService.restoreToEvent({ rootPageId, eventId }),
    onSuccess: (_, { rootPageId }) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(rootPageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.files(rootPageId) });
      queryClient.invalidateQueries({ queryKey: historyKeys.byProject(rootPageId) });
      toast.success('Đã khôi phục về sự kiện lịch sử');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi khôi phục lịch sử');
    },
  });

  return {
    history,
    isLoading,
    restoreToEvent,
  };
}

export function useHistoryActions() {
  const queryClient = useQueryClient();

  const restoreToEvent = useMutation({
    mutationFn: ({ rootPageId, eventId }: { rootPageId: string; eventId: string }) =>
      historyService.restoreToEvent({ rootPageId, eventId }),
    onSuccess: (_, { rootPageId }) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(rootPageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.files(rootPageId) });
      queryClient.invalidateQueries({ queryKey: historyKeys.byProject(rootPageId) });
      toast.success('Đã khôi phục về sự kiện lịch sử');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi khôi phục lịch sử');
    },
  });

  return {
    restoreToEvent,
  };
}

export const useProjectHistoryActions = useHistoryActions;

