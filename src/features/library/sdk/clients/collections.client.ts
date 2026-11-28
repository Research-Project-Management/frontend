import type {
  Collection,
  CreateCollectionDto,
  UpdateCollectionDto,
} from '@/features/library/types/core.types';
import {
  libraryClient,
  resolveLibraryUrl,
  getBasePath,
  getCatalogUrl,
  getExportsUrl,
  isProjectScope,
} from './http.client';

// 2. CollectionsService
export const CollectionsService = {
  getAll: (spaceId?: string) =>
    libraryClient.get<{ collections: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections', spaceId),
    ),

  create: (spaceId: string | undefined, data: CreateCollectionDto) =>
    libraryClient.post<{ collection: Collection }>(
      resolveLibraryUrl('catalog', '/collections', spaceId),
      data,
    ),

  update: (spaceId: string | undefined, collectionId: string, data: UpdateCollectionDto) =>
    libraryClient.put<{ collection: Collection }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}`, spaceId),
      data,
    ),

  delete: (spaceId: string | undefined, collectionId: string, strategy?: 'cascade' | 'move-to-parent' | 'orphan') =>
    libraryClient.delete(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}`, spaceId),
      strategy ? { params: { strategy } } : undefined,
    ),

  copy: (
    spaceId: string | undefined,
    collectionId: string,
    data?: { parentId?: string | null },
  ) =>
    libraryClient.post<{ collection: Collection; copiedCount?: number }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/copy`, spaceId),
      data ?? {},
    ),

  moveItems: (
    spaceId: string | undefined,
    collectionId: string,
    itemIds: string[],
    sourceCollectionId?: string | null,
  ) =>
    libraryClient.post<{ message: string; count: number; targetCollectionId: string | null }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/move-items`, spaceId),
      {
        itemIds,
        ...(sourceCollectionId ? { sourceCollectionId } : {}),
      },
    ),

  assignItems: (
    spaceId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    libraryClient.post<{ success?: boolean; count: number; collectionId?: string }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items`, spaceId),
      { itemIds },
    ),

  bulkDetachItems: (
    spaceId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    libraryClient.post<{ success: boolean; count: number }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items/bulk-detach`, spaceId),
      { itemIds },
    ),

  exportBibtex: (spaceId: string | undefined, collectionId: string) =>
    libraryClient.get<{ bibtex: string; total: number; filename: string }>(
      `${getExportsUrl(spaceId)}?format=bibtex&collectionId=${encodeURIComponent(collectionId)}`,
    ),

  exportBundle: (spaceId: string | undefined, collectionId: string) =>
    libraryClient.get<{
      collection: { id: string; name: string };
      totalItems?: number;
      filesIncluded?: number;
      totalFiles?: number;
      bibtex: string;
      files: Array<{ itemId?: string; title: string; filename: string; fileUrl: string }>;
    }>(
      getExportsUrl(spaceId, `${encodeURIComponent(collectionId)}/export-bundle`),
    ),
};
