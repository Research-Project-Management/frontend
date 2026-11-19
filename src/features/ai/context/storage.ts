'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllFiles, type StorageItem } from '@/features/storage';
import { normalizeSpaceId } from '../transport/flux';
import type { SourceAdapter, SourceEntry } from './source.port';

export interface StorageFolderEntry {
  id: string;
  name: string;
}

export interface StorageFileEntry {
  id: string;
  filename: string;
  mimeType?: string;
  isFolder: boolean;
  size?: number;
  entry: SourceEntry;
}

export const storageSourceAdapter: SourceAdapter<StorageItem> = {
  type: 'storage',
  toSourceEntry(file) {
    if (!file?.id || file.isFolder) return null;
    return {
      id: file.id,
      name: file.filename || 'Document',
      size: file.size,
      enabled: true,
      sourceType: 'storage',
    };
  },
};

export interface UseStorageContextItemsOptions {
  spaceId?: string | null;
  parentId?: string | null;
  search?: string;
  enabled?: boolean;
}

export function useStorageContextItems({
  spaceId,
  parentId = null,
  search = '',
  enabled = true,
}: UseStorageContextItemsOptions) {
  const cleanSpaceId = normalizeSpaceId(spaceId) ?? null;
  const cleanParentId = parentId ?? null;
  const trimmedSearch = search.trim();

  const { data: items = [], isLoading } = useQuery<StorageItem[]>({
    queryKey: [
      'ai',
      'context',
      'storage',
      cleanSpaceId,
      cleanParentId,
      trimmedSearch,
    ] as const,
    queryFn: async () => {
      const res = await getAllFiles(cleanSpaceId, {
        parentId: cleanParentId,
        search: trimmedSearch || undefined,
        limit: 100,
      });
      return res?.files ?? [];
    },
    enabled,
    staleTime: 30_000,
  });

  const folders = useMemo<StorageFolderEntry[]>(
    () =>
      items
        .filter((i) => i.isFolder)
        .map((i) => ({ id: i.id, name: i.filename || 'Folder' })),
    [items],
  );

  const files = useMemo<StorageFileEntry[]>(() => {
    const list: StorageFileEntry[] = [];
    for (const item of items) {
      if (item.isFolder) continue;
      const entry = storageSourceAdapter.toSourceEntry(item);
      if (!entry) continue;
      list.push({
        id: item.id,
        filename: item.filename || entry.name,
        mimeType: item.mimeType,
        isFolder: false,
        size: item.size,
        entry,
      });
    }
    return list;
  }, [items]);

  return { folders, files, isLoading };
}
