'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArchiveService } from '@/features/projects/project-id/work-items/api/work-item.api';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';
import { workItemToast } from './use-work-item-toast';

export const archiveKeys = {
  all: ['archived-items'] as const,
  project: (projectId: string) => ['archived-items', projectId] as const,
};

export const useArchivedItems = (projectId: string) =>
  useQuery({
    queryKey: archiveKeys.project(projectId),
    queryFn: async () => {
      const res = await ArchiveService.getArchived(projectId);
      if (Array.isArray(res)) return res as Item[];
      if (res && typeof res === 'object') {
        const resObj = res as unknown as Record<string, unknown>;
        const items = resObj.archivedItems || resObj.workItems || resObj.data;
        if (Array.isArray(items)) return items as Item[];
      }
      return [] as Item[];
    },
    enabled: Boolean(projectId),
  });

export const useArchiveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      workItemToast.success('Work item archived', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to archive work item', 'action'),
  });
};

export const useRestoreItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      workItemToast.success('Work item restored', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to restore work item', 'action'),
  });
};

export const useBulkArchive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ids?: string[]; itemIds?: string[]; workItemIds?: string[]; projectId?: string }) => {
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      return ArchiveService.bulkArchive(targetIds, vars.projectId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: ['work-items', vars.projectId] });
        queryClient.invalidateQueries({ queryKey: ['archived-items', vars.projectId] });
      }
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      workItemToast.success(`Archived ${targetIds.length} items`, 'bulk');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to archive work items', 'bulk'),
  });
};

export const useBulkRestore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ids?: string[]; itemIds?: string[]; workItemIds?: string[]; projectId?: string }) => {
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      return ArchiveService.bulkRestore(targetIds, vars.projectId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: ['work-items', vars.projectId] });
        queryClient.invalidateQueries({ queryKey: ['archived-items', vars.projectId] });
      }
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      workItemToast.success(`Restored ${targetIds.length} items`, 'bulk');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to restore work items', 'bulk'),
  });
};

