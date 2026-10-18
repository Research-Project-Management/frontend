'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '@/features/projects/project-id/work-items/api/work-item.api';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';
import { resolveItemId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { invalidateWorkItemRelatedQueries } from './use-work-items-query';
import { workItemToast } from './use-work-item-toast';

type ProjectItemsCache =
  | Item[]
  | ({ items?: Item[]; workItems?: Item[] } & Record<string, unknown>);

function filterItemsCache(
  old: ProjectItemsCache | undefined,
  predicate: (item: Item) => boolean,
): ProjectItemsCache | undefined {
  if (!old) return old;
  if (Array.isArray(old)) return old.filter(predicate);
  return {
    ...old,
    ...(Array.isArray(old.items) ? { items: old.items.filter(predicate) } : {}),
    ...(Array.isArray(old.workItems) ? { workItems: old.workItems.filter(predicate) } : {}),
  };
}

export const archiveKeys = {
  all: ['archived-items'] as const,
  project: (projectId: string) => ['archived-items', projectId] as const,
};

export const useArchivedItems = (projectId: string) =>
  useQuery({
    queryKey: archiveKeys.project(projectId),
    queryFn: async () => {
      const res = await workItemApi.archive.getArchived(projectId);
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
    mutationFn: (id: string) => workItemApi.archive.archive(id),
    onSuccess: (res, id) => {
      const serverItem = res?.workItem || res?.item;
      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) =>
        filterItemsCache(old, (item) => resolveItemId(item) !== id),
      );
      if (serverItem) {
        queryClient.setQueriesData<Item[]>({ queryKey: ['archived-items'] }, (old) => {
          if (!Array.isArray(old)) return old;
          const rawArchivedAt = (serverItem as Item & { archivedAt?: string | null }).archivedAt;
          const archivedItem = {
            ...serverItem,
            archivedAt: rawArchivedAt || new Date().toISOString(),
          } as Item;
          if (old.some((i) => resolveItemId(i) === id)) {
            return old.map((i) => (resolveItemId(i) === id ? archivedItem : i));
          }
          return [archivedItem, ...old];
        });
      }
      invalidateWorkItemRelatedQueries(queryClient, serverItem?.projectId);
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      queryClient.invalidateQueries({ queryKey: ['work-item-activity', id] });
      workItemToast.success('Work item archived', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to archive work item', 'action'),
  });
};

export const useRestoreItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workItemApi.archive.restore(id),
    onSuccess: (res, id) => {
      const serverItem = res?.workItem || res?.item;
      queryClient.setQueriesData<Item[]>({ queryKey: ['archived-items'] }, (old) =>
        Array.isArray(old) ? old.filter((item) => resolveItemId(item) !== id) : old,
      );
      if (serverItem) {
        const restoredItem = { ...serverItem, archivedAt: null };
        const projectId = restoredItem.projectId;
        if (projectId) {
          queryClient.setQueriesData<ProjectItemsCache>(
            { queryKey: ['work-items', projectId] },
            (old) => {
              if (!old) return old;
              const addOrReplace = (list: Item[]) => {
                if (list.some((i) => resolveItemId(i) === id)) {
                  return list.map((i) => (resolveItemId(i) === id ? { ...i, ...restoredItem } : i));
                }
                return [...list, restoredItem];
              };
              if (Array.isArray(old)) return addOrReplace(old);
              return {
                ...old,
                ...(Array.isArray(old.items) ? { items: addOrReplace(old.items) } : {}),
                ...(Array.isArray(old.workItems) ? { workItems: addOrReplace(old.workItems) } : {}),
              };
            },
          );
        }
      }
      invalidateWorkItemRelatedQueries(queryClient, serverItem?.projectId);
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      queryClient.invalidateQueries({ queryKey: ['work-item-activity', id] });
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
      return workItemApi.archive.bulkArchive(targetIds, vars.projectId);
    },
    onSuccess: (_, vars) => {
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      const idSet = new Set(targetIds);
      if (idSet.size > 0) {
        queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) =>
          filterItemsCache(old, (item) => !idSet.has(resolveItemId(item))),
        );
      }
      invalidateWorkItemRelatedQueries(queryClient, vars.projectId);
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: ['archived-items', vars.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
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
      return workItemApi.archive.bulkRestore(targetIds, vars.projectId);
    },
    onSuccess: (_, vars) => {
      const targetIds = vars.ids || vars.itemIds || vars.workItemIds || [];
      const idSet = new Set(targetIds);
      if (idSet.size > 0) {
        queryClient.setQueriesData<Item[]>({ queryKey: ['archived-items'] }, (old) =>
          Array.isArray(old) ? old.filter((item) => !idSet.has(resolveItemId(item))) : old,
        );
      }
      invalidateWorkItemRelatedQueries(queryClient, vars.projectId);
      queryClient.invalidateQueries({ queryKey: ['archived-items'] });
      if (vars.projectId) {
        queryClient.invalidateQueries({ queryKey: ['archived-items', vars.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      workItemToast.success(`Restored ${targetIds.length} items`, 'bulk');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to restore work items', 'bulk'),
  });
};

