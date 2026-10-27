'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SyncService } from '../library.client';
import {
  mapBackendItem,
  hasExplicitUserStateInPayload,
} from '@/features/library/domain/metadata';
import type { Item } from '@/features/library/domain/types/library.types';
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
  removeItemsFromScopeCaches,
  resolveCachedItemFromScope,
} from './cache-patcher';

function hasSyncVersionAdvanced(currentSeq: string, nextVersion: string): boolean {
  if (!nextVersion || nextVersion === currentSeq || nextVersion === '0') {
    return false;
  }
  if (/^\d+$/.test(currentSeq) && /^\d+$/.test(nextVersion)) {
    return BigInt(nextVersion) > BigInt(currentSeq);
  }
  return nextVersion !== currentSeq;
}

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

  return useQuery({
    queryKey: libraryKeys.syncVersion(effectiveScope),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 10_000,
    queryFn: async () => {
      if (lastScopeRef.current !== effectiveScope) {
        lastScopeRef.current = effectiveScope;
        lastSyncSeqRef.current = null;
      }
      const versionRes = await SyncService.getVersion(effectiveScope);
      const remoteVersion = String(versionRes?.version ?? '0');

      if (lastSyncSeqRef.current === null) {
        lastSyncSeqRef.current = remoteVersion;
        return {
          version: remoteVersion,
          scopeId: effectiveScope,
          syncedCount: 0,
        };
      }

      if (!hasSyncVersionAdvanced(lastSyncSeqRef.current, remoteVersion)) {
        return {
          version: remoteVersion,
          scopeId: effectiveScope,
          syncedCount: 0,
        };
      }

      let currentSince = lastSyncSeqRef.current;
      const deletedItemIds: string[] = [];
      let patchedCount = 0;
      let hasCreatedItems = false;
      let shouldInvalidateCollections = false;
      let shouldInvalidateTags = false;
      let shouldInvalidateSavedSearches = false;
      let shouldInvalidateAnnotations = false;
      const noteItemIdsToInvalidate = new Set<string>();
      const attachmentItemIdsToInvalidate = new Set<string>();
      const relationItemIdsToInvalidate = new Set<string>();
      const patchedItemIdsToInvalidate = new Set<string>();
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
            lastSyncSeqRef.current = '0';
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
              queryClient.invalidateQueries({ queryKey: collectionKeys.all(effectiveScope) }),
              queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) }),
              queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) }),
              queryClient.invalidateQueries({ queryKey: libraryKeys.savedSearches(effectiveScope) }),
            ]);
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
          lastSyncSeqRef.current = '0';
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
            queryClient.invalidateQueries({ queryKey: collectionKeys.all(effectiveScope) }),
            queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) }),
          ]);
          return {
            version: remoteVersion,
            scopeId: effectiveScope,
            syncedCount: 0,
            fullSync: true,
          };
        }
        const changes = Array.isArray(changesRes?.changes) ? changesRes.changes : [];
        if (changes.length === 0) {
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

          if (entityType === 'collection' || entityType === 'collectionitem') {
            shouldInvalidateCollections = true;
            continue;
          }

          if (entityType === 'tag' || entityType === 'itemtag') {
            shouldInvalidateTags = true;
            continue;
          }

                    if (entityType === 'saved_search' || entityType === 'savedsearch') {
            shouldInvalidateSavedSearches = true;
            continue;
          }

          if (entityType === 'annotation') {
            shouldInvalidateAnnotations = true;
            continue;
          }

          if (entityType === 'attachment') {
            const parentItemId = String(rawData.itemId ?? change.itemId ?? '');
            if (parentItemId) {
              attachmentItemIdsToInvalidate.add(parentItemId);
            }
            continue;
          }

          if (entityType === 'relation') {
            const parentItemId = String(rawData.itemId ?? change.itemId ?? '');
            if (parentItemId) {
              relationItemIdsToInvalidate.add(parentItemId);
            }
            continue;
          }
          if (entityType === 'note') {
            const parentItemId = String(
              rawData.itemId ?? change.itemId ?? '',
            );
            if (parentItemId) {
              noteItemIdsToInvalidate.add(parentItemId);
            }
            continue;
          }

          if (entityType !== 'item' || !itemId) continue;

          if (
            action === 'DELETE' ||
            action === 'DELETED' ||
            action === 'PURGE' ||
            action === 'PURGED' ||
            Boolean(rawData.deletedAt)
          ) {
            deletedItemIds.push(itemId);
          } else {
            if (action === 'CREATE' || action === 'CREATED' || action === 'RESTORE' || action === 'RESTORED') {
              hasCreatedItems = true;
            }
            const mapped = mapBackendItem(rawData);
            const existingCached = resolveCachedItemFromScope(
              queryClient,
              effectiveScope,
              itemId,
            );
            const rawHasExplicitState = hasExplicitUserStateInPayload(rawData);
            const patch: Partial<Item> = {
              ...mapped,
              id: itemId,
              ...(typeof change.version === 'number'
                ? { version: change.version }
                : {}),
              ...(existingCached && !rawHasExplicitState
                ? {
                    isStarred: existingCached.isStarred,
                    isFavorite: existingCached.isFavorite,
                    isRead: existingCached.isRead,
                    readStatus: existingCached.readStatus,
                    rating: existingCached.rating,
                    ...(existingCached.lastReadAt !== undefined
                      ? { lastReadAt: existingCached.lastReadAt }
                      : {}),
                  }
                : {}),
            };
            if (!rawHasExplicitState) {
              Object.defineProperty(patch, '_hasExplicitUserState', {
                value: false,
                enumerable: false,
                configurable: true,
                writable: true,
              });
            }
            patchItemAcrossScopeCaches(queryClient, effectiveScope, itemId, patch);
            patchedItemIdsToInvalidate.add(itemId);
            patchedCount++;
          }
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

      if (deletedItemIds.length > 0) {
        removeItemsFromScopeCaches(queryClient, effectiveScope, deletedItemIds);
      }

      lastSyncSeqRef.current = hasMore ? currentSince : remoteVersion;

      const postSyncInvalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({
          queryKey: itemKeys.counts(effectiveScope),
        }),
      ];
      for (const patchedItemId of patchedItemIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: itemKeys.byId(effectiveScope, patchedItemId),
            refetchType: 'active',
          }),
        );
      }
      if (hasCreatedItems || patchedCount > 0 || deletedItemIds.length > 0) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: itemKeys.trash(effectiveScope),
            refetchType: 'active',
          }),
        );
      }
      if (hasCreatedItems) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: itemKeys.all(effectiveScope),
            refetchType: 'active',
          }),
        );
      }
      if (shouldInvalidateCollections) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: collectionKeys.all(effectiveScope),
          }),
        );
      }
      if (shouldInvalidateTags) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: tagKeys.list(effectiveScope),
          }),
        );
      }
      if (shouldInvalidateSavedSearches) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.savedSearches(effectiveScope),
          }),
        );
      }
      if (shouldInvalidateAnnotations) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.annotations(effectiveScope),
          }),
        );
      }
      for (const parentItemId of attachmentItemIdsToInvalidate) {
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
      for (const parentItemId of relationItemIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: libraryKeys.relations(effectiveScope, parentItemId),
          }),
        );
      }
      for (const parentItemId of noteItemIdsToInvalidate) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: noteKeys.list(effectiveScope, parentItemId),
          }),
        );
      }
      await Promise.all(postSyncInvalidations);

      return {
        version: remoteVersion,
        scopeId: effectiveScope,
        syncedCount: patchedCount + deletedItemIds.length,
      };
    },
  });
}
