'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SyncService } from '../clients/catalog-entities.client';
import {
  mapBackendItem,
  hasExplicitUserStateInPayload,
  preserveMappedItemFlags,
  setMappedItemMeta,
} from '@/features/library/domain/metadata.mapper';
import type { Item } from '@/features/library/types/core.types';
import {
  itemKeys,
  libraryKeys,
  collectionKeys,
  tagKeys,
  noteKeys,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  patchItemAcrossScopeCaches,
  preserveCachedUserReadingState,
  removeItemsFromScopeCaches,
  resolveCachedItemFromScope,
} from './cache-patcher.queries';

function hasSyncVersionAdvanced(currentSeq: string, nextVersion: string): boolean {
  if (!nextVersion || nextVersion === currentSeq || nextVersion === '0') {
    return false;
  }
  if (/^\d+$/.test(currentSeq) && /^\d+$/.test(nextVersion)) {
    return BigInt(nextVersion) > BigInt(currentSeq);
  }
  return nextVersion !== currentSeq;
}

interface DeltaChangeRecord {
  raw: Record<string, unknown>;
  entityType: string;
  action: string;
  rawData: Record<string, unknown>;
  itemId: string;
  version?: number;
}

interface DeltaSyncBatchContext {
  queryClient: ReturnType<typeof useQueryClient>;
  effectiveScope: string;
  deletedItemIds: string[];
  patchedCount: number;
  abortedForMutation: boolean;
  hasCreatedItems: boolean;
  shouldInvalidateCollections: boolean;
  shouldInvalidateTags: boolean;
  shouldInvalidateSavedSearches: boolean;
  shouldInvalidateAnnotations: boolean;
  shouldInvalidateAllAttachments: boolean;
  shouldInvalidateAllRelations: boolean;
  shouldInvalidateAllNotes: boolean;
  annotationAttachmentIdsToInvalidate: Set<string>;
  noteItemIdsToInvalidate: Set<string>;
  attachmentItemIdsToInvalidate: Set<string>;
  relationItemIdsToInvalidate: Set<string>;
  patchedItemIdsToInvalidate: Set<string>;
}

const handleCollectionChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  ctx.shouldInvalidateCollections = true;
  if (change.entityType === 'collectionitem' || change.entityType === 'item_collection') {
    ctx.hasCreatedItems = true;
  }
};

const handleTagChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  ctx.shouldInvalidateTags = true;
  if (change.entityType === 'itemtag' || change.entityType === 'item_tag') {
    ctx.hasCreatedItems = true;
  }
};

const handleSavedSearchChange = (_change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  ctx.shouldInvalidateSavedSearches = true;
};

const handleAnnotationChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  const attachmentId = String(
    (change.raw.data as Record<string, unknown> | null)?.attachmentId ??
      change.rawData.attachmentId ??
      change.raw.attachmentId ??
      '',
  );
  if (attachmentId) {
    ctx.annotationAttachmentIdsToInvalidate.add(attachmentId);
  }
  ctx.shouldInvalidateAnnotations = true;
};

const handleAttachmentChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  const parentItemId = String(change.rawData.itemId ?? change.raw.itemId ?? '');
  if (parentItemId) {
    ctx.attachmentItemIdsToInvalidate.add(parentItemId);
  } else {
    ctx.shouldInvalidateAllAttachments = true;
  }
};

const handleRelationChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  const parentItemId = String(change.rawData.itemId ?? change.raw.itemId ?? '');
  if (parentItemId) {
    ctx.relationItemIdsToInvalidate.add(parentItemId);
  } else {
    ctx.shouldInvalidateAllRelations = true;
  }
};

const handleNoteChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  const parentItemId = String(change.rawData.itemId ?? change.raw.itemId ?? '');
  if (parentItemId) {
    ctx.noteItemIdsToInvalidate.add(parentItemId);
  } else {
    ctx.shouldInvalidateAllNotes = true;
  }
};

const handleStateChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  const rawEntityId = String(change.itemId || '');
  const stateItemId = String(
    change.rawData.itemId ??
      change.raw.itemId ??
      (rawEntityId.includes(':') ? rawEntityId.split(':').pop() : rawEntityId) ??
      '',
  );
  if (!stateItemId) return;

  if (ctx.queryClient.isMutating() > 0) {
    ctx.abortedForMutation = true;
    return;
  }

  const readStatusRaw =
    typeof change.rawData.readStatus === 'string'
      ? change.rawData.readStatus
      : undefined;
  const isStarred =
    typeof change.rawData.isStarred === 'boolean'
      ? change.rawData.isStarred
      : undefined;
  const rating =
    typeof change.rawData.rating === 'number'
      ? change.rawData.rating
      : undefined;
  const currentPage =
    typeof change.rawData.currentPage === 'number'
      ? change.rawData.currentPage
      : undefined;
  const lastReadAt =
    typeof change.rawData.lastReadAt === 'string'
      ? change.rawData.lastReadAt
      : undefined;
  const lastOpenedAt =
    typeof change.rawData.lastOpenedAt === 'string'
      ? change.rawData.lastOpenedAt
      : undefined;

  const normalizedStatus =
    typeof readStatusRaw === 'string'
      ? (readStatusRaw.trim().toLowerCase() as Item['readStatus'])
      : undefined;

  const patch: Partial<Item> = {
    id: stateItemId,
    ...(isStarred !== undefined ? { isStarred } : {}),
    ...(normalizedStatus !== undefined
      ? {
          readStatus: normalizedStatus,
          isRead: normalizedStatus === 'completed',
        }
      : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(currentPage !== undefined
      ? { currentPage, lastReadPage: currentPage }
      : {}),
    ...(lastReadAt !== undefined ? { lastReadAt } : {}),
    ...(lastOpenedAt !== undefined ? { lastOpenedAt } : {}),
  };

  setMappedItemMeta(patch, { hasExplicitUserState: true });
  patchItemAcrossScopeCaches(
    ctx.queryClient,
    ctx.effectiveScope,
    stateItemId,
    patch,
  );
  ctx.patchedItemIdsToInvalidate.add(stateItemId);
  ctx.patchedCount++;
};

const handleItemChange = (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => {
  const { itemId, action, rawData, version } = change;
  if (!itemId) return;

  if (
    action === 'DELETE' ||
    action === 'DELETED' ||
    action === 'PURGE' ||
    action === 'PURGED' ||
    Boolean(rawData.deletedAt)
  ) {
    ctx.deletedItemIds.push(itemId);
    return;
  }

  if (
    action === 'CREATE' ||
    action === 'CREATED' ||
    action === 'RESTORE' ||
    action === 'RESTORED'
  ) {
    ctx.hasCreatedItems = true;
  }
  const mapped = mapBackendItem(rawData);
  const existingCached = resolveCachedItemFromScope(
    ctx.queryClient,
    ctx.effectiveScope,
    itemId,
  );
  const rawHasExplicitState = hasExplicitUserStateInPayload(rawData);
  const shouldPreserveExistingUserState = Boolean(
    existingCached && (!rawHasExplicitState || ctx.effectiveScope !== 'user'),
  );
  const hasExplicitCollections =
    'collections' in rawData || 'collectionIds' in rawData || 'collectionItems' in rawData;
  const hasExplicitTags = 'tags' in rawData || 'itemTags' in rawData || 'keywords' in rawData;
  const hasExplicitAttachments = 'attachments' in rawData || 'files' in rawData;
  const hasExplicitNotes = 'notes' in rawData || 'notesList' in rawData;

  const patch: Partial<Item> = {
    ...mapped,
    id: itemId,
    ...(typeof version === 'number' ? { version } : {}),
    ...(existingCached && !hasExplicitCollections
      ? {
          collectionIds: existingCached.collectionIds,
        }
      : {}),
    ...(existingCached && !hasExplicitTags ? { tags: existingCached.tags } : {}),
    ...(existingCached && !hasExplicitAttachments
      ? {
          attachments: existingCached.attachments,
          ...(existingCached.fileUrl !== undefined ? { fileUrl: existingCached.fileUrl } : {}),
          ...(existingCached.fileId !== undefined ? { fileId: existingCached.fileId } : {}),
          ...(existingCached.hasFile !== undefined ? { hasFile: existingCached.hasFile } : {}),
        }
      : {}),
    ...(existingCached && !hasExplicitNotes ? { notes: existingCached.notes } : {}),
  };
  if (shouldPreserveExistingUserState && existingCached) {
    preserveCachedUserReadingState(patch as Record<string, unknown>, existingCached, mapped);
  }
  preserveMappedItemFlags(mapped, patch);
  if (shouldPreserveExistingUserState || !rawHasExplicitState) {
    setMappedItemMeta(patch, { hasExplicitUserState: false });
  }
  if (ctx.queryClient.isMutating() > 0) {
    ctx.abortedForMutation = true;
    return;
  }
  patchItemAcrossScopeCaches(ctx.queryClient, ctx.effectiveScope, itemId, patch);
  ctx.patchedItemIdsToInvalidate.add(itemId);
  ctx.patchedCount++;
};

const DELTA_ENTITY_HANDLERS: Record<
  string,
  (change: DeltaChangeRecord, ctx: DeltaSyncBatchContext) => void
> = {
  collection: handleCollectionChange,
  collectionitem: handleCollectionChange,
  item_collection: handleCollectionChange,
  tag: handleTagChange,
  itemtag: handleTagChange,
  item_tag: handleTagChange,
  saved_search: handleSavedSearchChange,
  savedsearch: handleSavedSearchChange,
  annotation: handleAnnotationChange,
  attachment: handleAttachmentChange,
  relation: handleRelationChange,
  note: handleNoteChange,
  state: handleStateChange,
  item: handleItemChange,
  userpublication: handleItemChange,
};

/**
 * Lightweight CDC Delta Sync Hook for Library Scopes.
 *
 * Tracks monotonic sync sequence (`lastSyncSeqRef`) per `effectiveScope`, polls
 * `SyncService.getVersion(effectiveScope)` on window focus / interval, and when
 * the remote version advances, pulls incremental changes via `SyncService.getChanges`
 * to patch updated/created items and remove deleted items in the TanStack Query cache.
 */
export function useLibraryDeltaSync(
  scopeId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const lastSyncSeqRef = useRef<string | null>(null);
  const lastScopeRef = useRef<string>(effectiveScope);

  useEffect(() => {
    if (lastScopeRef.current !== effectiveScope) {
      lastScopeRef.current = effectiveScope;
      lastSyncSeqRef.current = null;
    }
  }, [effectiveScope]);

  const baseInterval = options?.refetchInterval;
  const resolvedRefetchInterval =
    baseInterval === false
      ? false
      : typeof baseInterval === 'number'
        ? baseInterval
        : () => Math.floor(30_000 * (0.85 + Math.random() * 0.3));

  return useQuery({
    queryKey: libraryKeys.syncVersion(effectiveScope),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: resolvedRefetchInterval,
    staleTime: 10_000,
    queryFn: async () => {
      if (lastScopeRef.current !== effectiveScope) {
        lastScopeRef.current = effectiveScope;
        lastSyncSeqRef.current = null;
      }

      const readCachedSyncVersion = () => {
        const cachedSync = queryClient.getQueryData<{
          version?: string;
          scopeId?: string;
        }>(libraryKeys.syncVersion(effectiveScope));
        return cachedSync?.version && cachedSync.version !== '0'
          ? String(cachedSync.version)
          : null;
      };

      if (lastSyncSeqRef.current === null) {
        const initialCachedVersion = readCachedSyncVersion();
        if (initialCachedVersion) {
          lastSyncSeqRef.current = initialCachedVersion;
        }
      }

      const bootstrapQueries = queryClient.getQueriesData({
        queryKey: libraryKeys.bootstrap(effectiveScope).slice(0, 3),
      });
      const isBootstrapping = bootstrapQueries.some(([key]) => {
        const state = queryClient.getQueryState(key);
        return state?.fetchStatus === 'fetching' && state?.status === 'pending';
      });
      if (isBootstrapping && lastSyncSeqRef.current === null) {
        const bootstrapVersion = readCachedSyncVersion() ?? '0';
        if (bootstrapVersion !== '0') {
          lastSyncSeqRef.current = bootstrapVersion;
        }
        return {
          version: bootstrapVersion,
          scopeId: effectiveScope,
          syncedCount: 0,
        };
      }

      const versionRes = await SyncService.getVersion(effectiveScope);
      const remoteVersion = String(versionRes?.version ?? '0');

      if (lastSyncSeqRef.current === null) {
        const postBootstrapVersion = readCachedSyncVersion();
        if (postBootstrapVersion) {
          lastSyncSeqRef.current = postBootstrapVersion;
        } else {
          lastSyncSeqRef.current = remoteVersion;
          return {
            version: remoteVersion,
            scopeId: effectiveScope,
            syncedCount: 0,
          };
        }
      }

      if (!hasSyncVersionAdvanced(lastSyncSeqRef.current, remoteVersion)) {
        return {
          version: remoteVersion,
          scopeId: effectiveScope,
          syncedCount: 0,
        };
      }

      if (queryClient.isMutating() > 0) {
        return {
          version: lastSyncSeqRef.current,
          scopeId: effectiveScope,
          syncedCount: 0,
          deferredForMutation: true,
        };
      }

      const invalidateFullSyncScopeCaches = () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
          queryClient.invalidateQueries({ queryKey: collectionKeys.all(effectiveScope) }),
          queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) }),
          queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) }),
          queryClient.invalidateQueries({ queryKey: libraryKeys.savedSearches(effectiveScope) }),
        ]);

      let currentSince = lastSyncSeqRef.current;
      const batchCtx: DeltaSyncBatchContext = {
        queryClient,
        effectiveScope,
        deletedItemIds: [],
        patchedCount: 0,
        abortedForMutation: false,
        hasCreatedItems: false,
        shouldInvalidateCollections: false,
        shouldInvalidateTags: false,
        shouldInvalidateSavedSearches: false,
        shouldInvalidateAnnotations: false,
        shouldInvalidateAllAttachments: false,
        shouldInvalidateAllRelations: false,
        shouldInvalidateAllNotes: false,
        annotationAttachmentIdsToInvalidate: new Set<string>(),
        noteItemIdsToInvalidate: new Set<string>(),
        attachmentItemIdsToInvalidate: new Set<string>(),
        relationItemIdsToInvalidate: new Set<string>(),
        patchedItemIdsToInvalidate: new Set<string>(),
      };
      let pagesFetched = 0;
      const MAX_SYNC_PAGES = 10;
      let hasMore = true;

      while (hasMore && pagesFetched < MAX_SYNC_PAGES) {
        pagesFetched++;
        let changesRes: {
          since?: string;
          nextCursor?: string | null;
          nextSince?: string | null;
          count?: number;
          compacted?: boolean;
          hasMore?: boolean;
          fullSyncRequired?: boolean;
          changes?: Array<Record<string, unknown>>;
        };
        try {
          changesRes = (await SyncService.getChanges(effectiveScope, {
            since: currentSince,
            limit: 100,
          })) as {
            since?: string;
            nextCursor?: string | null;
            nextSince?: string | null;
            count?: number;
            compacted?: boolean;
            hasMore?: boolean;
            fullSyncRequired?: boolean;
            changes?: Array<Record<string, unknown>>;
          };
        } catch (err: unknown) {
          const errObj = err as { status?: number; response?: { status?: number }; code?: string; message?: string } | null;
          const is410 =
            errObj?.status === 410 ||
            errObj?.response?.status === 410 ||
            errObj?.code === 'SYNC_RESET_REQUIRED' ||
            String(errObj?.message || '').includes('SYNC_RESET_REQUIRED') ||
            String(errObj?.message || '').includes('410');
          if (is410) {
            lastSyncSeqRef.current = remoteVersion;
            await invalidateFullSyncScopeCaches();
            return {
              version: remoteVersion,
              scopeId: effectiveScope,
              syncedCount: 0,
              fullSync: true,
            };
          }
          throw err;
        }
        if (changesRes?.fullSyncRequired) {
          lastSyncSeqRef.current = remoteVersion;
          await invalidateFullSyncScopeCaches();
          return {
            version: remoteVersion,
            scopeId: effectiveScope,
            syncedCount: 0,
            fullSync: true,
          };
        }

        if (queryClient.isMutating() > 0) {
          batchCtx.abortedForMutation = true;
          break;
        }

        const changes = Array.isArray(changesRes?.changes) ? changesRes.changes : [];
        if (changes.length === 0) {
          const emptyPageCursor =
            changesRes?.nextCursor || changesRes?.nextSince || null;
          if (
            changesRes?.hasMore &&
            emptyPageCursor &&
            emptyPageCursor !== currentSince
          ) {
            currentSince = emptyPageCursor;
            continue;
          }
          hasMore = false;
          break;
        }

        for (const change of changes) {
          if (!change || typeof change !== 'object') continue;
          const entityType = String(
            change.entityType ?? change.type ?? 'Item',
          ).toLowerCase();
          const action = String(
            change.action ?? change.operation ?? 'UPDATE',
          ).toUpperCase();
          const rawData =
            change.data && typeof change.data === 'object'
              ? (change.data as Record<string, unknown>)
              : change.item && typeof change.item === 'object'
                ? (change.item as Record<string, unknown>)
                : change;
          const itemId = String(
            change.entityId ?? change.itemId ?? rawData.id ?? change.id ?? '',
          );

          const handler = DELTA_ENTITY_HANDLERS[entityType];
          if (handler) {
            handler(
              {
                raw: change,
                entityType,
                action,
                rawData,
                itemId,
                version: typeof change.version === 'number' ? change.version : undefined,
              },
              batchCtx,
            );
            if (batchCtx.abortedForMutation) {
              break;
            }
          } else {
            batchCtx.hasCreatedItems = true;
          }
        }

        if (batchCtx.abortedForMutation) {
          break;
        }

        const lastChangeSeq = changes[changes.length - 1]?.seq;
        const nextCursor =
          changesRes?.nextCursor ||
          changesRes?.nextSince ||
          (lastChangeSeq !== undefined ? String(lastChangeSeq) : null);

        hasMore = Boolean(changesRes?.hasMore && nextCursor && nextCursor !== currentSince);
        if (hasMore && nextCursor) {
          currentSince = nextCursor;
        } else {
          hasMore = false;
          break;
        }
      }

      if (batchCtx.deletedItemIds.length > 0) {
        removeItemsFromScopeCaches(queryClient, effectiveScope, batchCtx.deletedItemIds);
      }

      if (batchCtx.abortedForMutation) {
        lastSyncSeqRef.current = currentSince;
        return {
          version: currentSince,
          scopeId: effectiveScope,
          syncedCount: batchCtx.patchedCount + batchCtx.deletedItemIds.length,
          deferredForMutation: true,
        };
      }

      const settledSyncVersion = hasMore ? currentSince : remoteVersion;
      lastSyncSeqRef.current = settledSyncVersion;

      const postSyncInvalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({
          queryKey: itemKeys.counts(effectiveScope),
        }),
      ];
      if (batchCtx.hasCreatedItems) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: itemKeys.all(effectiveScope),
            refetchType: 'active',
          }),
        );
      } else {
        for (const patchedItemId of batchCtx.patchedItemIdsToInvalidate) {
          postSyncInvalidations.push(
            queryClient.invalidateQueries({
              queryKey: itemKeys.byId(effectiveScope, patchedItemId),
              refetchType: 'active',
            }),
          );
        }
        if (batchCtx.patchedCount > 0 || batchCtx.deletedItemIds.length > 0) {
          postSyncInvalidations.push(
            queryClient.invalidateQueries({
              queryKey: itemKeys.trash(effectiveScope),
              refetchType: 'active',
            }),
          );
        }
      }
      if (batchCtx.shouldInvalidateCollections) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: collectionKeys.all(effectiveScope),
          }),
        );
      }
      if (batchCtx.shouldInvalidateTags) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: tagKeys.list(effectiveScope),
          }),
        );
      }
      if (
        batchCtx.shouldInvalidateSavedSearches ||
        batchCtx.hasCreatedItems ||
        batchCtx.patchedCount > 0 ||
        batchCtx.deletedItemIds.length > 0 ||
        batchCtx.shouldInvalidateCollections ||
        batchCtx.shouldInvalidateTags
      ) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.savedSearches(effectiveScope),
          }),
        );
      }
      for (const attachmentId of batchCtx.annotationAttachmentIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.annotations(effectiveScope, attachmentId),
          }),
        );
      }
      if (batchCtx.shouldInvalidateAnnotations) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.annotationsAll(effectiveScope),
          }),
        );
      }
      if (batchCtx.shouldInvalidateAllAttachments) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.attachmentsAll(effectiveScope),
          }),
        );
      }
      for (const parentItemId of batchCtx.attachmentItemIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.attachments(effectiveScope, parentItemId),
          }),
          queryClient.invalidateQueries({
            queryKey: itemKeys.byId(effectiveScope, parentItemId),
            refetchType: 'active',
          }),
        );
      }
      if (batchCtx.shouldInvalidateAllRelations) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.relationsAll(effectiveScope),
          }),
        );
      }
      for (const parentItemId of batchCtx.relationItemIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.relations(effectiveScope, parentItemId),
          }),
        );
      }
      if (batchCtx.shouldInvalidateAllNotes) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: noteKeys.lists(),
          }),
          queryClient.invalidateQueries({
            queryKey: noteKeys.all(effectiveScope),
          }),
        );
      }
      for (const parentItemId of batchCtx.noteItemIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: noteKeys.list(effectiveScope, parentItemId),
          }),
        );
      }
      await Promise.all(postSyncInvalidations);

      return {
        version: settledSyncVersion,
        scopeId: effectiveScope,
        syncedCount: batchCtx.patchedCount + batchCtx.deletedItemIds.length,
      };
    },
  });
}
