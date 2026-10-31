'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import {
  useLibraryCommandStore,
  buildInverseMetadataPatch,
  createUpdateItemMetadataCommand,
} from '@/features/library/core/manager/library-command.manager';
import {
  useLibraryItemDetailQuery,
  useUpdateLibraryItemMutation,
  useLibraryCacheSynchronizer,
  mergeCachedItemWithPatch,
} from '@/features/library/sdk/queries/catalog.queries';
import { normalizeTags, getAssignedCollectionIds } from '@/features/library/domain/metadata-mapper';
import type { Item } from '@/features/library/domain/types/core.types';

export interface UsePanelResizeOptions {
  /** Initial or controlled width of the panel in pixels */
  width: number;
  /** Callback fired continuously during drag and on release */
  setWidth: (width: number) => void;
  /** Direction of the handle relative to the panel ('right' for Left Sidebar, 'left' for Right Inspector) */
  direction?: 'left' | 'right';
  /** Minimum allowable width in px (default: 200) */
  minWidth?: number;
  /** Maximum allowable width in px (default: 640) */
  maxWidth?: number;
}

/**
 * Headless hook for fluid, requestAnimationFrame-debounced panel resizing.
 * Unifies sidebar (left panel) and inspector (right panel) border drag handles.
 */
export function usePanelResize({
  width,
  setWidth,
  direction = 'right',
  minWidth = 200,
  maxWidth = 640,
}: UsePanelResizeOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const latestClientXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const clampWidth = useCallback(
    (val: number) => Math.min(Math.max(val, minWidth), maxWidth),
    [minWidth, maxWidth],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      latestClientXRef.current = e.clientX;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    if (!isDragging) return;

    const sign = direction === 'right' ? 1 : -1;
    const computeNextWidth = () =>
      clampWidth(startWidthRef.current + sign * (latestClientXRef.current - startXRef.current));

    const handleMouseMove = (e: MouseEvent) => {
      latestClientXRef.current = e.clientX;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          setWidth(computeNextWidth());
          rafIdRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setWidth(computeNextWidth());
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, setWidth, direction, clampWidth]);

  return {
    isDragging,
    handleMouseDown,
  };
}

export interface UseInspectorItemResolverParams {
  propItem?: Item | null;
  scopeId?: string;
  canEdit?: boolean;
  needsFullDetail?: boolean;
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
  handleUpdateItem: (
    payload: Partial<Item>,
    options?: { silent?: boolean; skipHistory?: boolean },
  ) => void;
}

export function useInspectorItemResolver({
  propItem,
  scopeId,
  canEdit = true,
  needsFullDetail = false,
}: UseInspectorItemResolverParams = {}): UseInspectorItemResolverResult {
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const targetScope = scopeId || 'user';
  const incomingItem = propItem || null;

  const queryItemId = !incomingItem && activeItemId ? activeItemId : undefined;
  const { resolveCachedItem } = useLibraryCacheSynchronizer(targetScope);
  const cachedListItem = useMemo(
    () => resolveCachedItem(queryItemId, targetScope),
    [resolveCachedItem, queryItemId, targetScope],
  );

  const hasCachedCoreMetadata = Boolean(
    cachedListItem &&
      cachedListItem.title !== undefined &&
      Array.isArray(cachedListItem.contributors) &&
      cachedListItem.abstractNote !== undefined,
  );
  const shouldFetchFullDetail = Boolean(
    queryItemId && (needsFullDetail || !hasCachedCoreMetadata),
  );

  const { data: queriedItem, isLoading } = useLibraryItemDetailQuery(
    targetScope,
    queryItemId,
    { enabled: shouldFetchFullDetail },
  );

  const lastItemRef = useRef<Item | null>(null);
  const effectiveItem =
    incomingItem ||
    (queriedItem && (!activeItemId || queriedItem.id === activeItemId) ? queriedItem : null) ||
    (cachedListItem && (!activeItemId || cachedListItem.id === activeItemId) ? cachedListItem : null) ||
    (activeItemId && lastItemRef.current?.id === activeItemId ? lastItemRef.current : null);

  useEffect(() => {
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
  }, [activeItemId, queriedItem, cachedListItem, isLoading]);

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
  const latestItemSnapshotRef = useRef<Map<string, Item>>(new Map());
  const pendingMutationPromiseRef = useRef<Map<string, Promise<unknown>>>(new Map());

  useEffect(() => {
    if (!effectiveItem?.id) return;
    if (
      !pendingMutationPromiseRef.current.has(effectiveItem.id) ||
      !latestItemSnapshotRef.current.has(effectiveItem.id)
    ) {
      latestItemSnapshotRef.current.set(effectiveItem.id, effectiveItem);
    }
    if (typeof effectiveItem.version === 'number') {
      const tracked = latestVersionRef.current.get(effectiveItem.id);
      if (
        tracked === undefined ||
        (!pendingMutationPromiseRef.current.has(effectiveItem.id) &&
          effectiveItem.version > tracked)
      ) {
        latestVersionRef.current.set(effectiveItem.id, effectiveItem.version);
      }
    }
  }, [effectiveItem]);

  const enqueueItemPatch = useCallback(
    (
      targetItemId: string,
      patch: Partial<Item>,
      fallbackVersion?: number,
      isSilent = false,
    ): Promise<unknown> => {
      const currentSnapshot = latestItemSnapshotRef.current.get(targetItemId);
      if (currentSnapshot) {
        latestItemSnapshotRef.current.set(
          targetItemId,
          mergeCachedItemWithPatch(currentSnapshot, patch),
        );
      }
      const prevPromise = pendingMutationPromiseRef.current.get(targetItemId) ?? Promise.resolve();
      const nextPromise = prevPromise
        .catch(() => undefined)
        .then(async () => {
          const trackedVersion = latestVersionRef.current.get(targetItemId);
          const expectedVersion =
            typeof trackedVersion === 'number'
              ? trackedVersion
              : typeof fallbackVersion === 'number'
                ? fallbackVersion
                : undefined;

          const res = await updateMutation.mutateAsync({
            itemId: targetItemId,
            data: patch,
            expectedVersion,
            silent: isSilent,
          });

          const returnedItem =
            res && typeof res === 'object' && 'item' in res && res.item
              ? (res.item as Partial<Item>)
              : (res as Partial<Item> | undefined);

          if (typeof returnedItem?.version === 'number') {
            latestVersionRef.current.set(targetItemId, returnedItem.version);
          } else if (typeof expectedVersion === 'number') {
            latestVersionRef.current.set(targetItemId, expectedVersion + 1);
          }
          if (returnedItem && typeof returnedItem === 'object') {
            const snap = latestItemSnapshotRef.current.get(targetItemId);
            if (snap) {
              latestItemSnapshotRef.current.set(
                targetItemId,
                mergeCachedItemWithPatch(snap, returnedItem),
              );
            }
          }
          return res;
        })
        .catch((err) => {
          latestVersionRef.current.delete(targetItemId);
          latestItemSnapshotRef.current.delete(targetItemId);
          throw err;
        })
        .finally(() => {
          if (pendingMutationPromiseRef.current.get(targetItemId) === nextPromise) {
            pendingMutationPromiseRef.current.delete(targetItemId);
          }
        });

      pendingMutationPromiseRef.current.set(targetItemId, nextPromise);
      return nextPromise;
    },
    [updateMutation],
  );

  const handleUpdateItem = useCallback(
    (payload: Partial<Item>, options?: { silent?: boolean; skipHistory?: boolean }) => {
      if (!effectiveItem || !effectiveCanEdit) return;
      const itemId = effectiveItem.id;
      const fallbackVersion = payload.version ?? effectiveItem.version;
      const isSilent = options?.silent !== undefined ? Boolean(options.silent) : (payload.silent !== undefined ? Boolean(payload.silent) : true);
      const skipHistory = Boolean(options?.skipHistory);

      const baseSnapshot = latestItemSnapshotRef.current.get(itemId) ?? effectiveItem;
      if (!latestItemSnapshotRef.current.has(itemId)) {
        latestItemSnapshotRef.current.set(itemId, effectiveItem);
      }
      if (
        typeof effectiveItem.version === 'number' &&
        !latestVersionRef.current.has(itemId)
      ) {
        latestVersionRef.current.set(itemId, effectiveItem.version);
      }
      const inversePatch = buildInverseMetadataPatch(baseSnapshot, payload);
      const command = createUpdateItemMetadataCommand({
        itemId,
        description: baseSnapshot.title
          ? `Updated "${baseSnapshot.title}"`
          : 'Updated item metadata',
        forwardPatch: payload,
        inversePatch,
        applyPatch: (targetId, patch) => enqueueItemPatch(targetId, patch, undefined, true),
      });

      void enqueueItemPatch(itemId, payload, fallbackVersion, isSilent)
        .then(() => {
          if (!skipHistory) {
            useLibraryCommandStore.getState().pushExecutedCommand(command, { silentToast: true });
          }
        })
        .catch(() => undefined);
    },
    [effectiveItem, effectiveCanEdit, enqueueItemPatch],
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
