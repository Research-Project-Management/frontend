'use client';

import { useMemo, useRef, useCallback } from 'react';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import {
  useLibraryItemDetailQuery,
  useUpdateLibraryItemMutation,
  useLibraryCacheSynchronizer,
} from '@/features/library/sdk/queries/catalog.queries';
import { normalizeTags, getAssignedCollectionIds } from '@/features/library/domain/metadata';
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

export function useInspectorItemResolver({
  propItem,
  scopeId,
  canEdit = true,
}: UseInspectorItemResolverParams = {}): UseInspectorItemResolverResult {
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const targetScope = scopeId || 'user';
  const incomingItem = propItem || null;

  const queryItemId = !incomingItem && activeItemId ? activeItemId : undefined;
  const { data: queriedItem, isLoading } = useLibraryItemDetailQuery(
    targetScope,
    queryItemId,
  );

  const { resolveCachedItem } = useLibraryCacheSynchronizer(targetScope);
  const cachedListItem = useMemo(
    () => resolveCachedItem(queryItemId, targetScope),
    [resolveCachedItem, queryItemId, targetScope],
  );

  const lastItemRef = useRef<Item | null>(null);
  if (!activeItemId || (lastItemRef.current && lastItemRef.current.id !== activeItemId)) {
    lastItemRef.current = null;
  }
  if (queriedItem && (!activeItemId || queriedItem.id === activeItemId)) {
    lastItemRef.current = queriedItem;
  } else if (cachedListItem && (!activeItemId || cachedListItem.id === activeItemId)) {
    lastItemRef.current = cachedListItem;
  } else if (!isLoading && !queriedItem && !cachedListItem) {
    lastItemRef.current = null;
  }

  const effectiveItem =
    incomingItem ||
    (queriedItem && (!activeItemId || queriedItem.id === activeItemId) ? queriedItem : null) ||
    (cachedListItem && (!activeItemId || cachedListItem.id === activeItemId) ? cachedListItem : null) ||
    (activeItemId && lastItemRef.current?.id === activeItemId ? lastItemRef.current : null);

  const isItemInTrash = Boolean(effectiveItem?.deletedAt);
  const effectiveCanEdit = canEdit && !isItemInTrash;

  const attachmentCount = effectiveItem?.attachments?.length ?? 0;
  const noteCount = effectiveItem?.notes?.length ?? 0;

  const tagsList = useMemo(() => normalizeTags(effectiveItem), [effectiveItem]);

  const itemCollectionIds = useMemo(
    () => getAssignedCollectionIds(effectiveItem),
    [effectiveItem],
  );

  const updateMutation = useUpdateLibraryItemMutation(targetScope);
  const latestVersionRef = useRef<Map<string, number>>(new Map());
  const pendingMutationPromiseRef = useRef<Map<string, Promise<unknown>>>(new Map());

  if (effectiveItem?.id && typeof effectiveItem.version === 'number') {
    const tracked = latestVersionRef.current.get(effectiveItem.id);
    if (tracked === undefined || (!pendingMutationPromiseRef.current.has(effectiveItem.id) && effectiveItem.version > tracked)) {
      latestVersionRef.current.set(effectiveItem.id, effectiveItem.version);
    }
  }

  const handleUpdateItem = useCallback(
    (payload: Partial<Item>, options?: { silent?: boolean }) => {
      if (!effectiveItem || !effectiveCanEdit) return;
      const itemId = effectiveItem.id;
      const fallbackVersion = payload.version ?? effectiveItem.version;
      const isSilent = Boolean(options?.silent || payload.silent);

      const prevPromise = pendingMutationPromiseRef.current.get(itemId) ?? Promise.resolve();
      const nextPromise = prevPromise
        .catch(() => undefined)
        .then(async () => {
          const trackedVersion = latestVersionRef.current.get(itemId);
          const expectedVersion =
            typeof trackedVersion === 'number'
              ? trackedVersion
              : typeof fallbackVersion === 'number'
                ? fallbackVersion
                : undefined;

          const res = await updateMutation.mutateAsync({
            itemId,
            data: payload,
            expectedVersion,
            silent: isSilent,
          });

          const returnedItem =
            res && typeof res === 'object' && 'item' in res && res.item
              ? (res.item as Partial<Item>)
              : (res as Partial<Item> | undefined);

          if (typeof returnedItem?.version === 'number') {
            latestVersionRef.current.set(itemId, returnedItem.version);
          } else if (typeof expectedVersion === 'number') {
            latestVersionRef.current.set(itemId, expectedVersion + 1);
          }
          return res;
        })
        .catch(() => {
          latestVersionRef.current.delete(itemId);
        })
        .finally(() => {
          if (pendingMutationPromiseRef.current.get(itemId) === nextPromise) {
            pendingMutationPromiseRef.current.delete(itemId);
          }
        });

      pendingMutationPromiseRef.current.set(itemId, nextPromise);
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
