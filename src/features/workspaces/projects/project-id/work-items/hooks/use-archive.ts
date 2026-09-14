'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArchiveService } from '../services/archive.service';
import type { Item } from '../types/work-item.types';

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
      if (res && typeof res === 'object' && 'archivedItems' in res && Array.isArray((res as any).archivedItems)) {
        return (res as any).archivedItems as Item[];
      }
      return [] as Item[];
    },
    enabled: Boolean(projectId),
  });

export const useArchivedWorkItems = useArchivedItems;

export const useArchiveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      toast.success('Work item archived');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to archive work item'),
  });
};

export const useArchiveWorkItem = useArchiveItem;

export const useRestoreItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ArchiveService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      toast.success('Work item restored');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to restore work item'),
  });
};

export const useRestoreWorkItem = useRestoreItem;

export const useBulkArchive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ids?: string[]; itemIds?: string[]; workItemIds?: string[]; projectId?: string }) => {
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      return ArchiveService.bulkArchive(targetIds);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      toast.success(`Archived ${targetIds.length} items`);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to archive work items'),
  });
};

export const useBulkArchiveItems = useBulkArchive;
export const useBulkArchiveWorkItems = useBulkArchive;

export const useBulkRestore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ids?: string[]; itemIds?: string[]; workItemIds?: string[]; projectId?: string }) => {
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      return ArchiveService.bulkRestore(targetIds);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      toast.success(`Restored ${targetIds.length} items`);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to restore work items'),
  });
};

export const useBulkRestoreItems = useBulkRestore;
export const useBulkRestoreWorkItems = useBulkRestore;
