'use client';

import { useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import {
  useLibraryItemDetailQuery,
  useUpdateLibraryItemMutation,
} from '@/features/library/sdk/queries/catalog.queries';
import { itemKeys } from '@/features/library/sdk/query-keys';
import { normalizeTags } from '@/features/library/domain/metadata';
import type { Item } from '@/features/library/domain/types/library.types';

export interface UseInspectorItemResolverParams {
  propItem?: Item | null;
  scopeId?: string;
  canEdit?: boolean;
}

export interface UseInspectorItemResolverResult {
  effectiveItem: Item | null;
  targetScope: string;
  isLoading: boolean;
  effectiveCanEdit: boolean;
  isItemInTrash: boolean;
  attachmentCount: number;
  noteCount: number;
  tagsList: string[];
  itemCollectionIds: string[];
  handleUpdateItem: (payload: Partial<Item>, options?: { silent?: boolean }) => void;
}

/**
 * useInspectorItemResolver
 *
 * Repository / Resolver Pattern for Inspector Item Resolution.
 * Centralizes:
 * 1. Scope and active item identification.
 * 2. Multi-tier cache lookup (direct key lookup -> list query scanning) to avoid network flicker.
 * 3. Ref persistence to prevent layout bounce during selection transitions.
 * 4. Permission computation (soft-deletion guard).
 * 5. Normalized bibliographic badges (tags, attachments count, notes count, collection IDs).
 * 6. Centralized update item mutation dispatcher with optimistic version tracking.
 */
export function useInspectorItemResolver({
  propItem,
  scopeId,
  canEdit = true,
}: UseInspectorItemResolverParams = {}): UseInspectorItemResolverResult {
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const targetScope = scopeId || 'user';
  const incomingItem = propItem || null;

  // 1. If item was not passed directly as a prop, query by activeItemId
  const queryItemId = !incomingItem && activeItemId ? activeItemId : undefined;
  const { data: queriedItem, isLoading } = useLibraryItemDetailQuery(
    targetScope,
    queryItemId,
  );

  const queryClient = useQueryClient();

  // 2. Fast-lookup in existing query cache to eliminate any loading flicker/jump when clicking different items
  const cachedListItem = useMemo(() => {
    if (!queryItemId) return null;
    const directCached = queryClient.getQueryData<Item | { item?: Item }>(
      itemKeys.byId(targetScope, queryItemId),
    );
    const resolvedDirect = (
      directCached && 'item' in directCached && directCached.item
        ? directCached.item
        : directCached
    ) as Item | undefined;
    if (resolvedDirect && resolvedDirect.id === queryItemId) return resolvedDirect;

    const queries = queryClient.getQueriesData<{ items?: Item[] }>({
      queryKey: itemKeys.all(targetScope),
    });
    for (const [_, data] of queries) {
      if (Array.isArray(data?.items)) {
        const found = data.items.find((it: Item) => it.id === queryItemId);
        if (found) return found;
      }
    }
    return null;
  }, [queryClient, targetScope, queryItemId]);

  // 3. Keep previous item while switching items to prevent unmounting and layout bounce
  const lastItemRef = useRef<Item | null>(null);
  if (queriedItem) {
    lastItemRef.current = queriedItem;
  } else if (cachedListItem) {
    lastItemRef.current = cachedListItem;
  } else if (!activeItemId) {
    lastItemRef.current = null;
  }

  const effectiveItem =
    incomingItem ||
    queriedItem ||
    cachedListItem ||
    (activeItemId ? lastItemRef.current : null);

  const isItemInTrash = Boolean(effectiveItem?.deletedAt);
  const effectiveCanEdit = canEdit && !isItemInTrash;

  // 4. Badges and Counts
  const attachmentCount = effectiveItem?.attachments?.length ?? 0;
  const noteCount = effectiveItem?.notes?.length ?? 0;

  const tagsList = useMemo(() => {
    return normalizeTags(effectiveItem);
  }, [effectiveItem]);

  const itemCollectionIds = useMemo(() => {
    if (!effectiveItem) return [];
    const ids = new Set<string>();
    if (Array.isArray(effectiveItem.collectionIds)) {
      effectiveItem.collectionIds.forEach((id: string) => id && ids.add(id));
    }
    if (Array.isArray(effectiveItem.collections)) {
      effectiveItem.collections.forEach((c: { id?: string }) => c?.id && ids.add(c.id));
    }
    return Array.from(ids);
  }, [effectiveItem]);

  // 5. Update Mutation Dispatcher
  const updateMutation = useUpdateLibraryItemMutation(targetScope);

  const handleUpdateItem = useCallback(
    (payload: Partial<Item>, options?: { silent?: boolean }) => {
      if (!effectiveItem || !effectiveCanEdit) return;
      const version = payload.version ?? effectiveItem.version;
      const isSilent = Boolean(options?.silent || payload.silent);
      updateMutation.mutate({
        itemId: effectiveItem.id,
        data: payload,
        expectedVersion: typeof version === 'number' ? version : undefined,
        silent: isSilent,
      });
    },
    [effectiveItem, effectiveCanEdit, updateMutation],
  );

  return {
    effectiveItem,
    targetScope,
    isLoading,
    effectiveCanEdit,
    isItemInTrash,
    attachmentCount,
    noteCount,
    tagsList,
    itemCollectionIds,
    handleUpdateItem,
  };
}
