'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useIntersectionObserver } from '@/shared/hooks/use-intersection-observer';
import { formatBytes } from '@/shared/utils/format';
import { storageKeys } from '../constants/storage.keys';
import type { StorageResponse } from '../types/storage.types';
import {
  usePreviewStore,
  useStorageFilterStore,
  type StorageSection,
} from '../store/storage-ui.store';
import {
  getAllFiles,
  getMyFiles,
  getSharedFiles,
  getStarredFiles,
  getTrashedFiles,
  getFileById,
  getFolderPath,
  createFolder,
  toggleStarItem,
  deleteItem,
  renameItem,
  moveItem,
  batchMoveItems,
  batchDeleteItems,
  batchStarItems,
  updateFileMetadata,
  moveToTrash,
  restoreItem,
  permanentlyDeleteItem,
  batchRestoreItems,
  batchPermanentlyDeleteItems,
  getStorageUsage,
  getStorageQuota,
  getFileVersions,
  uploadNewFileVersion,
  revertFileVersion,
  type FileQueryParams,
  type FolderPathResponse,
  type StorageUsageResult,
  type StorageQuotaResponse,
} from '../services/drive.service';

export const DRIVE_QUERY_OPTIONS = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
};

// ── Drive Queries & Mutations ────────────────────────────────────────────────

export function useSectionFiles(
  section: StorageSection,
  scopeId?: string,
  parentId?: string | null,
  queryParams?: FileQueryParams,
) {
  const effectiveParentId =
    section === 'my-files' ? (parentId ?? undefined) : undefined;
  const mergedParams: FileQueryParams = {
    ...(effectiveParentId ? { parentId: effectiveParentId } : {}),
    ...queryParams,
  };

  return useInfiniteQuery({
    queryKey: [
      ...storageKeys.scoped(scopeId),
      'section',
      section,
      effectiveParentId ?? 'root',
      'infinite',
      mergedParams,
    ],
    queryFn: ({ pageParam = 1 }) => {
      const pageOpts = {
        ...mergedParams,
        page: pageParam as number,
        limit: 40,
      };
      switch (section) {
        case 'shared':
          return getSharedFiles(scopeId, pageOpts);
        case 'starred':
          return getStarredFiles(scopeId, pageOpts);
        case 'trash':
          return getTrashedFiles(scopeId, pageOpts);
        case 'my-files':
        case 'home':
        default:
          return getAllFiles(scopeId, pageOpts);
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useHomeFiles(
  scopeId?: string,
  parentId?: string | null,
  queryParams?: FileQueryParams,
  options?: { enabled?: boolean },
) {
  const mergedParams: FileQueryParams = {
    parentId: parentId ?? undefined,
    ...queryParams,
  };

  return useInfiniteQuery({
    queryKey: [
      ...storageKeys.workspaceHomeFiles(scopeId, parentId),
      'infinite',
      mergedParams,
    ],
    queryFn: ({ pageParam = 1 }) =>
      getAllFiles(scopeId, {
        ...mergedParams,
        page: pageParam as number,
        limit: 40,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useDriveFiles(
  scopeId?: string,
  parentId?: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: storageKeys.driveFiles(scopeId, parentId),
    queryFn: () => getAllFiles(scopeId, parentId),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export const useAllFiles = useDriveFiles;
export const useWorkspaceFiles = useDriveFiles;

function createInfiniteStorageQuery(
  getKey: (scopeId?: string) => readonly unknown[],
  fetcher: (
    scopeId?: string,
    params?: FileQueryParams,
  ) => Promise<StorageResponse>,
) {
  return function useInfiniteStorage(
    scopeId?: string,
    params?: FileQueryParams,
    options?: { enabled?: boolean },
  ) {
    return useInfiniteQuery({
      queryKey: [...getKey(scopeId), 'infinite', params],
      queryFn: ({ pageParam = 1 }) =>
        fetcher(scopeId, { ...params, page: pageParam as number, limit: 40 }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
      enabled: options?.enabled !== undefined ? options.enabled : true,
      ...DRIVE_QUERY_OPTIONS,
    });
  };
}

export const useMyFiles = createInfiniteStorageQuery(
  storageKeys.workspaceMyFiles,
  getMyFiles,
);
export const useSharedFiles = createInfiniteStorageQuery(
  storageKeys.workspaceShared,
  getSharedFiles,
);
export const useStarredFiles = createInfiniteStorageQuery(
  storageKeys.workspaceStarred,
  getStarredFiles,
);

export function useFileById(id?: string) {
  return useQuery({
    queryKey: ['storage', 'file', id],
    queryFn: () => getFileById(id!),
    enabled: !!id,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useFolderPath(folderId?: string | null) {
  return useQuery<FolderPathResponse>({
    queryKey: ['storage', 'folder-path', folderId],
    queryFn: () => getFolderPath(folderId!),
    enabled: !!folderId,
    staleTime: 30 * 1000,
  });
}

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      projectId,
      parentId,
    }: {
      name: string;
      projectId?: string;
      parentId?: string | null;
    }) => createFolder(name, { projectId, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useToggleStarItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => toggleStarItem(itemId),
    onSuccess: (_data, itemId) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === itemId) {
        usePreviewStore.getState().setSelectedItem({
          ...current,
          starred: !current.starred,
        });
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: (_data, itemId) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === itemId) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useRenameItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, name }: { itemId: string; name: string }) =>
      renameItem(itemId, name),
    onSuccess: (_data, { itemId, name }) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === itemId) {
        usePreviewStore.getState().setSelectedItem({
          ...current,
          filename: name,
          name,
        });
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useMoveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      parentId,
    }: {
      itemId: string;
      parentId: string | null;
    }) => moveItem(itemId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchMoveItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      parentId,
    }: {
      ids: string[];
      parentId: string | null;
    }) => batchMoveItems(ids, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchDeleteItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchDeleteItems(ids),
    onSuccess: (_data, ids) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && ids.includes(current.id)) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchStarItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, starred }: { ids: string[]; starred: boolean }) =>
      batchStarItems(ids, starred),
    onSuccess: (_data, { ids, starred }) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && ids.includes(current.id)) {
        usePreviewStore.getState().setSelectedItem({
          ...current,
          starred,
        });
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useUpdateFileMetadata = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fileId,
      metaData,
    }: {
      fileId: string;
      metaData: Record<string, unknown>;
    }) => updateFileMetadata(fileId, metaData),
    onSuccess: (_data, { fileId, metaData }) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === fileId) {
        usePreviewStore.getState().setSelectedItem({
          ...current,
          metaData,
        });
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

// ── Trash Hooks ──────────────────────────────────────────────────────────────

export function useTrash(
  scopeId?: string,
  params?: FileQueryParams,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceTrashed(scopeId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getTrashedFiles(scopeId, {
        ...params,
        page: pageParam as number,
        limit: 40,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export const useMoveToTrash = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => moveToTrash(itemId),
    onSuccess: (_data, itemId) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === itemId) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useRestoreItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => restoreItem(itemId),
    onSuccess: (_data, itemId) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === itemId) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const usePermanentlyDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => permanentlyDeleteItem(itemId),
    onSuccess: (_data, itemId) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === itemId) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchRestoreItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchRestoreItems(ids),
    onSuccess: (_data, ids) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && ids.includes(current.id)) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchPermanentDeleteItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchPermanentlyDeleteItems(ids),
    onSuccess: (_data, ids) => {
      const current = usePreviewStore.getState().selectedItem;
      if (current && ids.includes(current.id)) {
        usePreviewStore.getState().setSelectedItem(null);
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

// ── Quota Hooks ──────────────────────────────────────────────────────────────

export interface UseStorageQuotaOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useStorageUsage(scopeId?: string, projectId?: string) {
  return useQuery<StorageUsageResult>({
    queryKey: [...storageKeys.workspaceUsage(scopeId), projectId],
    queryFn: () => getStorageUsage(scopeId, projectId),
    enabled: true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useStorageQuota(options: UseStorageQuotaOptions = {}) {
  const { projectId, enabled = true } = options;

  const query = useQuery<StorageQuotaResponse>({
    queryKey: storageKeys.quota(projectId),
    queryFn: () => getStorageQuota({ projectId }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    enabled,
  });

  const rawUsed = query.data?.usedBytes ?? query.data?.totalBytes ?? 0;
  const rawLimit =
    query.data?.limitBytes ?? query.data?.maxBytes ?? 5 * 1024 * 1024 * 1024;
  const calculatedPercentage =
    query.data?.percentage !== undefined && query.data?.percentage > 0
      ? query.data.percentage
      : rawLimit > 0
        ? Math.round((Number(rawUsed) / Number(rawLimit)) * 100)
        : 0;

  return {
    data: query.data,
    quota: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isProjectScope: query.data?.scope === 'project',
    ownerName: query.data?.owner?.name || null,
    usedFormatted: query.data?.usedFormatted || formatBytes(Number(rawUsed)),
    projectFormatted: query.data?.projectFormatted || '0 MB',
    limitFormatted: query.data?.limitFormatted || formatBytes(Number(rawLimit)),
    percentage: calculatedPercentage,
  };
}

// ── File Version Hooks ───────────────────────────────────────────────────────

export function useFileVersions(fileId?: string) {
  return useQuery({
    queryKey: ['file-versions', fileId],
    queryFn: () =>
      fileId ? getFileVersions(fileId) : Promise.reject('No fileId'),
    enabled: Boolean(fileId),
    staleTime: 10 * 1000,
  });
}

export function useUploadNewVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      file,
      changeComment,
      onProgress,
    }: {
      fileId: string;
      file: File;
      changeComment?: string;
      onProgress?: (progress: number) => void;
    }) => {
      return uploadNewFileVersion(fileId, file, changeComment, onProgress);
    },
    onSuccess: (_, variables) => {
      toast.success('New version uploaded successfully!');
      queryClient.invalidateQueries({
        queryKey: ['file-versions', variables.fileId],
      });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload new version');
    },
  });
}

export function useRevertFileVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      versionNumber,
    }: {
      fileId: string;
      versionNumber: number;
    }) => {
      return revertFileVersion(fileId, versionNumber);
    },
    onSuccess: (_, variables) => {
      toast.success(`Reverted to version ${variables.versionNumber}!`);
      queryClient.invalidateQueries({
        queryKey: ['file-versions', variables.fileId],
      });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revert version');
    },
  });
}

// ── Query Params & Infinite Scroll Sentinel Hooks ────────────────────────────

export function useStorageQueryParams() {
  const { typeFilter, selectedTypes, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const queryParams: FileQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sortBy,
      types:
        selectedTypes.length > 0
          ? selectedTypes
          : typeFilter !== 'all'
            ? typeFilter
            : undefined,
    }),
    [debouncedSearch, sortBy, selectedTypes, typeFilter],
  );

  return {
    projectId: undefined,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    setSelectedItem,
    queryParams,
  };
}

export function useInfiniteSentinel({
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  rootMargin = '250px',
}: {
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { isIntersecting } = useIntersectionObserver(sentinelRef, {
    rootMargin,
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, isFetchingNextPage, onLoadMore]);

  return sentinelRef;
}

