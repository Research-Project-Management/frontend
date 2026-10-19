'use client';

import { useMemo, useRef, useEffect } from 'react';
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
import { storageKeys } from '../constants/storage.keys';
import {
  usePreviewStore,
  useStorageFilterStore,
  type StorageSection,
} from '../store/storage-ui.store';
import type { StorageItem } from '../types/storage.types';
import {
  getAllFiles,
  getSharedFiles,
  getStarredFiles,
  getTrashedFiles,
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
  restoreItem,
  permanentlyDeleteItem,
  batchRestoreItems,
  batchPermanentlyDeleteItems,
  getFileVersions,
  uploadNewFileVersion,
  revertFileVersion,
  type FileQueryParams,
  type FolderPathResponse,
} from '../services/drive.service';

export const DRIVE_QUERY_OPTIONS = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
};

// ── Drive Queries ────────────────────────────────────────────────────────────

export function useSectionFiles(
  section: StorageSection,
  scopeId?: string,
  parentId?: string | null,
  queryParams?: FileQueryParams,
) {
  const effectiveParentId =
    section === 'my-files' ? (parentId ?? undefined) : undefined;
  const canonicalSection: StorageSection =
    section === 'home' && !effectiveParentId ? 'my-files' : section;
  const mergedParams: FileQueryParams = {
    ...(effectiveParentId ? { parentId: effectiveParentId } : {}),
    ...queryParams,
  };

  return useInfiniteQuery({
    queryKey: storageKeys.section(
      scopeId,
      canonicalSection,
      effectiveParentId ?? null,
      mergedParams,
    ),
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

export function useFolderPath(folderId?: string | null) {
  return useQuery<FolderPathResponse>({
    queryKey: storageKeys.folderPath(folderId ?? null),
    queryFn: () => getFolderPath(folderId!),
    enabled: !!folderId,
    staleTime: 30 * 1000,
  });
}

// ── Shared Mutation Factory ──────────────────────────────────────────────────

function useStorageMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  syncPreview?: (current: StorageItem, variables: TVariables) => StorageItem | null | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      if (syncPreview) {
        const current = usePreviewStore.getState().selectedItem;
        if (current) {
          const next = syncPreview(current, variables);
          if (next !== undefined) {
            usePreviewStore.getState().setSelectedItem(next);
          }
        }
      }
      void queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
}

const clearPreviewIfSingleMatch = (current: StorageItem, itemId: string) =>
  current.id === itemId ? null : undefined;

const clearPreviewIfBatchMatch = (current: StorageItem, ids: string[]) =>
  ids.includes(current.id) ? null : undefined;

export const useCreateFolder = () =>
  useStorageMutation(
    ({
      name,
      projectId,
      parentId,
    }: {
      name: string;
      projectId?: string;
      parentId?: string | null;
    }) => createFolder(name, { projectId, parentId }),
  );

export const useToggleStarItem = () =>
  useStorageMutation(toggleStarItem, (current, itemId) =>
    current.id === itemId ? { ...current, starred: !current.starred } : undefined,
  );

export const useDeleteItem = () =>
  useStorageMutation(deleteItem, clearPreviewIfSingleMatch);

export const useRenameItem = () =>
  useStorageMutation(
    ({ itemId, name }: { itemId: string; name: string }) => renameItem(itemId, name),
    (current, { itemId, name }) =>
      current.id === itemId ? { ...current, filename: name } : undefined,
  );

export const useMoveItem = () =>
  useStorageMutation(({ itemId, parentId }: { itemId: string; parentId: string | null }) =>
    moveItem(itemId, parentId),
  );

export const useBatchMoveItems = () =>
  useStorageMutation(({ ids, parentId }: { ids: string[]; parentId: string | null }) =>
    batchMoveItems(ids, parentId),
  );

export const useBatchDeleteItems = () =>
  useStorageMutation(batchDeleteItems, clearPreviewIfBatchMatch);

export const useBatchStarItems = () =>
  useStorageMutation(
    ({ ids, starred }: { ids: string[]; starred: boolean }) => batchStarItems(ids, starred),
    (current, { ids, starred }) =>
      ids.includes(current.id) ? { ...current, starred } : undefined,
  );

export const useUpdateFileMetadata = () =>
  useStorageMutation(
    ({ fileId, metaData }: { fileId: string; metaData: Record<string, unknown> }) =>
      updateFileMetadata(fileId, metaData),
    (current, { fileId, metaData }) =>
      current.id === fileId
        ? { ...current, metaData: { ...(current.metaData || {}), ...metaData } }
        : undefined,
  );

// ── Trash Hooks ──────────────────────────────────────────────────────────────

export const useRestoreItem = () =>
  useStorageMutation(restoreItem, clearPreviewIfSingleMatch);

export const usePermanentlyDeleteItem = () =>
  useStorageMutation(permanentlyDeleteItem, clearPreviewIfSingleMatch);

export const useBatchRestoreItems = () =>
  useStorageMutation(batchRestoreItems, clearPreviewIfBatchMatch);

export const useBatchPermanentDeleteItems = () =>
  useStorageMutation(batchPermanentlyDeleteItems, clearPreviewIfBatchMatch);

// ── File Version Hooks ───────────────────────────────────────────────────────

export function useFileVersions(fileId?: string) {
  return useQuery({
    queryKey: storageKeys.versions(fileId ?? null),
    queryFn: () =>
      fileId ? getFileVersions(fileId) : Promise.reject(new Error('No fileId')),
    enabled: Boolean(fileId),
    staleTime: 10 * 1000,
  });
}

export function useUploadNewVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fileId,
      file,
      changeComment,
      onProgress,
    }: {
      fileId: string;
      file: File;
      changeComment?: string;
      onProgress?: (progress: number) => void;
    }) => uploadNewFileVersion(fileId, file, changeComment, onProgress),
    onSuccess: () => {
      toast.success('New version uploaded successfully!');
      void queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload new version');
    },
  });
}

export function useRevertFileVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fileId,
      versionNumber,
    }: {
      fileId: string;
      versionNumber: number;
    }) => revertFileVersion(fileId, versionNumber),
    onSuccess: (_, variables) => {
      toast.success(`Reverted to version ${variables.versionNumber}!`);
      void queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revert version');
    },
  });
}

// ── Query Params & Infinite Scroll Sentinel Hooks ────────────────────────────

export function useStorageQueryParams() {
  const { selectedTypes, sortBy, searchQuery, setSearchQuery } = useStorageFilterStore();
  const debouncedSearch = useDebounce(searchQuery, 300);

  const queryParams: FileQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sortBy,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
    }),
    [debouncedSearch, sortBy, selectedTypes],
  );

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
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
