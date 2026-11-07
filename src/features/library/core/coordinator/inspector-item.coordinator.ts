'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
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
import {
  prefetchReaderBootstrap,
  prefetchReaderDocumentBlob,
  buildPdfBlobCacheKey,
} from '@/features/library/sdk/queries/reader.queries';
import { getItemFileUrl } from '@/features/library/domain/identifiers.domain';
import { documentStorage } from '@/features/library/domain/reader-document-storage.domain';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import {
  normalizeTags,
  getAssignedCollectionIds,
} from '@/features/library/domain/metadata.mapper';
import {
  getBibliographicSchema,
  resolveBibliographicField,
  buildBibliographicFieldPatch,
} from '@/features/library/domain/bibliographic-schema.domain';
import { getCollectionAncestorPath } from '@/features/library/domain/collection-tree.domain';
import type {
  Item,
  Collection,
  CreateCollectionDTO,
} from '@/features/library/types/core.types';

export {
  getCollectionAncestorPath,
  getBibliographicSchema,
  resolveBibliographicField,
  buildBibliographicFieldPatch,
};

interface UsePanelResizeOptions {
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

interface UseInspectorItemResolverParams {
  propItem?: Item | null;
  scopeId?: string;
  canEdit?: boolean;
  needsFullDetail?: boolean;
}

interface UseInspectorItemResolverResult {
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

  const targetItemId = incomingItem?.id || activeItemId || undefined;
  const { queryClient, resolveCachedItem } = useLibraryCacheSynchronizer(targetScope);
  const cachedListItem = useMemo(
    () => resolveCachedItem(targetItemId, targetScope),
    [resolveCachedItem, targetItemId, targetScope],
  );

  const hasCachedCoreMetadata = Boolean(
    cachedListItem &&
      cachedListItem.title !== undefined &&
      Array.isArray(cachedListItem.contributors) &&
      cachedListItem.abstractNote !== undefined &&
      cachedListItem.extraFields !== undefined,
  );
  const shouldFetchFullDetail = Boolean(
    !incomingItem && targetItemId && (needsFullDetail || !hasCachedCoreMetadata),
  );

  const { data: queriedItem, isLoading } = useLibraryItemDetailQuery(
    targetScope,
    targetItemId,
    { enabled: shouldFetchFullDetail },
  );

  const lastItemRef = useRef<Item | null>(null);
  const fresherQueriedOrCached =
    queriedItem && (!targetItemId || queriedItem.id === targetItemId)
      ? queriedItem
      : cachedListItem && (!targetItemId || cachedListItem.id === targetItemId)
        ? cachedListItem
        : null;

  const effectiveItem =
    incomingItem &&
    fresherQueriedOrCached &&
    fresherQueriedOrCached.id === incomingItem.id &&
    (fresherQueriedOrCached.version ?? 0) >= (incomingItem.version ?? 0)
      ? fresherQueriedOrCached
      : incomingItem ||
        fresherQueriedOrCached ||
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

  // Smart Hover/Selection Prefetch (Zero-Wait First Open):
  // When user clicks a row in the Library Table to inspect its metadata, wait 250ms
  // (to ignore rapid keyboard arrow scrolling) then prefetch Reader Bootstrap metadata
  // and warm Tier-1 RAM from Tier-4 OPFS if the PDF was previously cached on disk.
  useEffect(() => {
    if (incomingItem || !effectiveItem?.id || isItemInTrash) return;
    const itemId = effectiveItem.id;
    const timer = setTimeout(() => {
      void prefetchReaderBootstrap(queryClient, targetScope, itemId);
      const candidatePdfUrl = getItemFileUrl(effectiveItem, targetScope);
      if (candidatePdfUrl) {
        const cacheKey = buildPdfBlobCacheKey(candidatePdfUrl, targetScope);
        void documentStorage.has(cacheKey).then((isCachedOnDisk: boolean) => {
          if (isCachedOnDisk) {
            void prefetchReaderDocumentBlob(candidatePdfUrl, { scopeId: targetScope });
          }
        });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [incomingItem, effectiveItem, isItemInTrash, queryClient, targetScope]);

  const attachmentCount =
    Array.isArray(effectiveItem?.attachments) && effectiveItem.attachments.length > 0
      ? effectiveItem.attachments.length
      : (effectiveItem?.attachmentCount ?? 0);
  const noteCount =
    Array.isArray(effectiveItem?.notes) && effectiveItem.notes.length > 0
      ? effectiveItem.notes.length
      : (effectiveItem?.noteCount ?? effectiveItem?.notesCount ?? 0);

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
      if (tracked === undefined || effectiveItem.version > tracked) {
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
      onPatchPrepared?: (prePatchSnapshot: Item | undefined) => void,
    ): Promise<unknown> => {
      const prevPromise = pendingMutationPromiseRef.current.get(targetItemId) ?? Promise.resolve();
      const nextPromise = prevPromise
        .catch(() => undefined)
        .then(async () => {
          const prePatchSnapshot = latestItemSnapshotRef.current.get(targetItemId);
          onPatchPrepared?.(prePatchSnapshot);
          if (prePatchSnapshot) {
            latestItemSnapshotRef.current.set(
              targetItemId,
              mergeCachedItemWithPatch(prePatchSnapshot, patch),
            );
          }

          const trackedVersion = latestVersionRef.current.get(targetItemId);
          const expectedVersion =
            typeof fallbackVersion === 'number'
              ? fallbackVersion
              : typeof trackedVersion === 'number'
                ? trackedVersion
                : undefined;

          try {
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
          } catch (err) {
            if (prePatchSnapshot) {
              latestItemSnapshotRef.current.set(targetItemId, prePatchSnapshot);
            } else {
              latestItemSnapshotRef.current.delete(targetItemId);
            }
            latestVersionRef.current.delete(targetItemId);
            throw err;
          }
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
    (
      payload: Partial<Item>,
      options?: { silent?: boolean; skipHistory?: boolean },
    ): Promise<unknown> => {
      if (!effectiveItem || !effectiveCanEdit) return Promise.resolve();
      const itemId = effectiveItem.id;
      const fallbackVersion = payload.version ?? effectiveItem.version;
      const isSilent =
        options?.silent !== undefined
          ? Boolean(options.silent)
          : payload.silent !== undefined
            ? Boolean(payload.silent)
            : true;
      const skipHistory = Boolean(options?.skipHistory);

      if (!latestItemSnapshotRef.current.has(itemId)) {
        latestItemSnapshotRef.current.set(itemId, effectiveItem);
      }
      if (
        typeof effectiveItem.version === 'number' &&
        !latestVersionRef.current.has(itemId)
      ) {
        latestVersionRef.current.set(itemId, effectiveItem.version);
      }

      let preparedInversePatch = buildInverseMetadataPatch(
        latestItemSnapshotRef.current.get(itemId) ?? effectiveItem,
        payload,
      );
      let preparedTitle = (
        latestItemSnapshotRef.current.get(itemId) ?? effectiveItem
      ).title;

      return enqueueItemPatch(
        itemId,
        payload,
        fallbackVersion,
        isSilent,
        (prePatchSnapshot) => {
          const baseSnapshot = prePatchSnapshot ?? effectiveItem;
          preparedInversePatch = buildInverseMetadataPatch(baseSnapshot, payload);
          preparedTitle = baseSnapshot.title;
        },
      )
        .then((res) => {
          if (!skipHistory) {
            const command = createUpdateItemMetadataCommand({
              itemId,
              description: preparedTitle
                ? `Updated "${preparedTitle}"`
                : 'Updated item metadata',
              forwardPatch: payload,
              inversePatch: preparedInversePatch,
              applyPatch: (targetId, patch) =>
                enqueueItemPatch(targetId, patch, undefined, true),
            });
            useLibraryCommandStore
              .getState()
              .pushExecutedCommand(command, { silentToast: true });
          }
          return res;
        })
        .catch((err) => {
          if (options?.skipHistory) {
            throw err;
          }
          return undefined;
        });
    },
    [effectiveItem, effectiveCanEdit, enqueueItemPatch],
  );

  return {
    effectiveItem,
    targetScope,
    isLoading,
    isItemInTrash,
    effectiveCanEdit,
    attachmentCount,
    noteCount,
    tagsList,
    itemCollectionIds,
    handleUpdateItem,
  };
}

/**
 * Shared coordinator hook for item collection assignment state & undoable toggle/remove.
 */
export function useItemCollectionsManager(
  item: Item,
  effectiveScope: string,
  canEdit: boolean,
  externalCollections?: Collection[],
  externalCreateCollection?: (
    data: CreateCollectionDTO & { scopeId?: string },
  ) => Promise<unknown>,
  onUpdateItem?: (
    payload: Partial<Item>,
    options?: { silent?: boolean; skipHistory?: boolean },
  ) => Promise<unknown> | void,
) {
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScope);
  const updateItem = useCallback(
    (
      itemId: string,
      data: Partial<Item>,
      options?: { expectedVersion?: number; silent?: boolean },
    ) => {
      if (onUpdateItem && itemId === item?.id) {
        return Promise.resolve(
          onUpdateItem(data, {
            silent: options?.silent ?? true,
            skipHistory: true,
          }),
        );
      }
      return updateItemMutation.mutateAsync({
        itemId,
        data,
        expectedVersion: options?.expectedVersion,
        silent: options?.silent ?? true,
      });
    },
    [onUpdateItem, item?.id, updateItemMutation],
  );
  const {
    collections: queriedCollections = [],
    createCollection: queriedCreateCollection,
  } = useCollections({
    scopeId: effectiveScope,
    enabled: externalCollections === undefined,
  });
  const collections = externalCollections ?? queriedCollections;
  const createCollection =
    externalCreateCollection ?? queriedCreateCollection;
  const pushExecutedCommand = useLibraryCommandStore((s) => s.pushExecutedCommand);
  const undoCommand = useLibraryCommandStore((s) => s.undo);

  const colMap = useMemo(() => {
    const map = new Map<string, Collection>();
    collections.forEach((c: Collection) => map.set(c.id, c));
    (item?.collections || []).forEach((c) => {
      if (c?.id && !map.has(c.id)) {
        map.set(c.id, c as Collection);
      }
    });
    return map;
  }, [collections, item?.collections]);

  const collectionSearchIndex = useMemo(() => {
    const pathMemo = new Map<string, string>();
    const index = new Map<
      string,
      { path: string; lowerPath: string; lowerName: string }
    >();
    colMap.forEach((col, id) => {
      const path = getCollectionAncestorPath(id, colMap, pathMemo);
      index.set(id, {
        path,
        lowerPath: path.toLowerCase(),
        lowerName: (col.name || '').toLowerCase(),
      });
    });
    return index;
  }, [colMap]);

  const assignedCollectionIdsSet = useMemo(
    () => new Set<string>(getAssignedCollectionIds(item)),
    [item],
  );

  const handleToggleCollection = useCallback(
    async (targetColId: string) => {
      if (!item?.id || !canEdit) return;
      const isAssigned = assignedCollectionIdsSet.has(targetColId);
      const prevIds = Array.from(assignedCollectionIdsSet);
      const remainingIds = isAssigned
        ? prevIds.filter((id) => id !== targetColId)
        : [...prevIds, targetColId];

      const targetItemId = item.id;
      const targetCol = colMap.get(targetColId);
      const colName = targetCol?.name || 'Collection';
      const commandDescription = isAssigned
        ? `Removed from "${colName}"`
        : `Added to "${colName}"`;

      const command = createUpdateItemMetadataCommand({
        itemId: targetItemId,
        description: commandDescription,
        forwardPatch: { collectionIds: remainingIds },
        inversePatch: { collectionIds: prevIds },
        applyPatch: (id, patch) => updateItem(id, patch, { silent: true }),
      });

      try {
        await updateItem(
          targetItemId,
          {
            collectionIds: remainingIds,
          },
          { expectedVersion: item.version },
        );

        pushExecutedCommand(command, { silentToast: true });

        const undoAction = {
          label: 'Undo',
          onClick: () => {
            void undoCommand(command.id);
          },
        };

        if (isAssigned) {
          const remainingCount = remainingIds.length;
          const description =
            remainingCount === 0
              ? 'Item is now in Unfiled Items (remains safely in your library).'
              : `Item remains in ${remainingCount} other ${remainingCount === 1 ? 'collection' : 'collections'}.`;

          toast.success(`Removed from "${colName}"`, {
            description,
            id: 'col-assign',
            duration: 3000,
            action: undoAction,
          });
        } else {
          toast.success(`Added to "${colName}"`, {
            id: 'col-assign',
            action: undoAction,
          });
        }
      } catch (err: unknown) {
        toast.error(`Failed to update "${colName}"`, {
          description: err instanceof Error ? err.message : 'Please try again.',
          id: 'col-assign',
        });
      }
    },
    [
      item?.id,
      item?.version,
      assignedCollectionIdsSet,
      canEdit,
      updateItem,
      colMap,
      pushExecutedCommand,
      undoCommand,
    ],
  );

  return {
    collections,
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    updateItem,
    createCollection,
    handleToggleCollection,
    pushExecutedCommand,
  };
}

export type ItemCollectionsManagerState = ReturnType<typeof useItemCollectionsManager>;
