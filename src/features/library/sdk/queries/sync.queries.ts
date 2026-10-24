'use client';

import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SyncService } from '../library.client';
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

  if (lastScopeRef.current !== effectiveScope) {
    lastScopeRef.current = effectiveScope;
    lastSyncSeqRef.current = null;
  }

  return useQuery({
    queryKey: libraryKeys.syncVersion(effectiveScope),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 10_000,
    queryFn: async () => {
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
      const noteItemIdsToInvalidate = new Set<string>();
      let pagesFetched = 0;

      while (pagesFetched < 10) {
        pagesFetched++;
        const changesRes = (await SyncService.getChanges(effectiveScope, {
          since: currentSince,
          limit: 100,
        })) as {
          since?: string;
          nextSince?: string;
          count?: number;
          hasMore?: boolean;
          fullSyncRequired?: boolean;
          changes?: Array<Record<string, unknown>>;
        };
        if (changesRes?.fullSyncRequired) {
          lastSyncSeqRef.current = remoteVersion;
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
        if (changes.length === 0) break;

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
            if (action === 'CREATE' || action === 'CREATED') {
              hasCreatedItems = true;
            }
            const patch: Partial<Item> = {
              ...(rawData as Partial<Item>),
              id: itemId,
              ...(typeof change.version === 'number'
                ? { version: change.version }
                : {}),
            };
            patchItemAcrossScopeCaches(queryClient, effectiveScope, itemId, patch);
            patchedCount++;
          }
        }

        const lastChangeSeq = changes[changes.length - 1]?.seq;
        const nextCursor =
          changesRes?.nextSince ||
          (lastChangeSeq !== undefined ? String(lastChangeSeq) : null);

        if (changesRes?.hasMore && nextCursor && nextCursor !== currentSince) {
          currentSince = nextCursor;
        } else {
          break;
        }
      }

      if (deletedItemIds.length > 0) {
        removeItemsFromScopeCaches(queryClient, effectiveScope, deletedItemIds);
      }

      lastSyncSeqRef.current = remoteVersion;

      const postSyncInvalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({
          queryKey: itemKeys.counts(effectiveScope),
        }),
      ];
      if (hasCreatedItems) {
        postSyncInvalidations.push(
          queryClient.invalidateQueries({
            queryKey: itemKeys.all(effectiveScope),
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
