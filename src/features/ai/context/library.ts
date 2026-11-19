'use client';

import { useMemo } from 'react';
import {
  buildTree,
  type TreeNode,
} from '@/features/library/domain/collection-tree.domain';
import { isProjectScope } from '@/features/library/domain/identifiers.domain';
import { ItemsService } from '@/features/library/sdk/clients/items.client';
import { useItems } from '@/features/library/sdk/queries/catalog.queries';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import type { Item } from '@/features/library/types/core.types';
import { normalizeSpaceId } from '../transport/flux';
import type { SourceAdapter, SourceEntry } from './source.port';

export interface ItemRagInfo {
  ragStatus?: string;
  ragDocId?: string;
  isIndexed: boolean;
}

export interface LibraryCollectionNode {
  id: string;
  name: string;
  children: LibraryCollectionNode[];
}

export interface LibraryPaperEntry {
  itemId: string;
  title: string;
  subtitle?: string;
  entry: SourceEntry;
}

export function extractRagInfo(item: Item): ItemRagInfo {
  const record = item as unknown as {
    ragStatus?: unknown;
    ragDocId?: unknown;
    metadata?: Record<string, unknown> | null;
  };
  const meta =
    record.metadata && typeof record.metadata === 'object'
      ? record.metadata
      : undefined;

  const ragStatus =
    typeof meta?.ragStatus === 'string'
      ? meta.ragStatus
      : typeof record.ragStatus === 'string'
        ? record.ragStatus
        : undefined;

  const ragDocId =
    typeof meta?.ragDocId === 'string'
      ? meta.ragDocId
      : typeof record.ragDocId === 'string'
        ? record.ragDocId
        : undefined;

  return {
    ragStatus,
    ragDocId,
    isIndexed: ragStatus === 'indexed' && Boolean(ragDocId),
  };
}

export const librarySourceAdapter: SourceAdapter<Item> = {
  type: 'library',
  toSourceEntry(item) {
    if (!item?.id) return null;
    const { ragDocId, isIndexed } = extractRagInfo(item);
    return {
      id: isIndexed && ragDocId ? ragDocId : item.id,
      name: item.title || 'Untitled Document',
      size: item.primaryFile?.size ?? item.size,
      enabled: true,
      sourceType: 'library',
    };
  },
};

function mapCollectionTree(nodes: TreeNode[]): LibraryCollectionNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    children: mapCollectionTree(node.children),
  }));
}

export interface UseLibraryContextItemsOptions {
  spaceId?: string | null;
  collectionId?: string;
  search?: string;
  enabled?: boolean;
}

export function useLibraryContextItems({
  spaceId,
  collectionId,
  search = '',
  enabled = true,
}: UseLibraryContextItemsOptions) {
  const libraryScope = spaceId && isProjectScope(spaceId) ? spaceId : 'user';

  const { collections } = useCollections({
    spaceId: libraryScope,
    enabled,
  });

  const {
    collectionItems,
    items: allLibraryItems,
    isLoadingCollection,
    isLoadingAll,
  } = useItems({
    spaceId: libraryScope,
    collectionId,
    enabled: enabled ? undefined : false,
  });

  const tree = useMemo(
    () => mapCollectionTree(buildTree(collections)),
    [collections],
  );

  const papers = useMemo<LibraryPaperEntry[]>(() => {
    const raw: Item[] = collectionId
      ? Array.isArray(collectionItems)
        ? collectionItems
        : []
      : (allLibraryItems ?? []);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? raw.filter((it) => (it.title || '').toLowerCase().includes(q))
      : raw;

    const list: LibraryPaperEntry[] = [];
    for (const item of filtered) {
      const entry = librarySourceAdapter.toSourceEntry(item);
      if (!entry) continue;
      const authorPart =
        item.authors && item.authors.length > 0
          ? item.authors.slice(0, 2).join(', ')
          : '';
      const yearPart = item.year ? ` (${item.year})` : '';
      const subtitle = authorPart ? `${authorPart}${yearPart}` : undefined;
      list.push({
        itemId: item.id,
        title: item.title || entry.name,
        subtitle,
        entry,
      });
    }
    return list;
  }, [collectionId, collectionItems, allLibraryItems, search]);

  return {
    tree,
    papers,
    isLoading: collectionId ? isLoadingCollection : isLoadingAll,
  };
}

export async function loadCollectionSources(
  collectionId: string,
  spaceId?: string | null,
): Promise<SourceEntry[]> {
  const targetScope = normalizeSpaceId(spaceId) ?? 'user';
  const res = await ItemsService.getByCollection(targetScope, collectionId);
  const resObj = res as unknown as Item[] | { papers?: Item[]; items?: Item[] };
  const papers: Item[] = Array.isArray(resObj)
    ? resObj
    : (resObj?.papers ?? resObj?.items ?? []);

  const entries: SourceEntry[] = [];
  for (const paper of papers) {
    const rag = extractRagInfo(paper);
    if (rag.isIndexed && rag.ragDocId) {
      entries.push({
        id: rag.ragDocId,
        name: paper.title || 'Untitled Paper',
        size: paper.primaryFile?.size ?? paper.size,
        enabled: true,
        sourceType: 'library',
      });
    }
  }
  return entries;
}
