'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IngestionService,
  CurationService,
  RetractionService,
  FeedsService,
} from '../clients/curation.client';
import { integrationService } from '@/features/settings/services/integration.service';
import type { UnifiedIngestionPayload, FlagRetractionInput } from '@/features/library/types/core.types';
import { mapServerFeedSubscriptions } from '@/features/library/domain/feed-parser.domain';
import type { SavedFeedSubscription } from '@/features/library/types/ingestion.types';
import {
  itemKeys,
  ingestKeys,
  feedKeys,
  curationKeys,
  retractionKeys,
  invalidateCollections,
  normalizeScopeId,
  waitForBootstrapCache,
  notifyServerFeedsHydrated,
  notifyReadEntriesHydrated,
  invokeLoadFeedsFallback,
  invokeAddFeed,
  invokeUpdateFeed,
  invokeRemoveFeed,
  getRegisteredFeedsSnapshot,
  notifyDraftCacheCleared,
} from '@/features/library/sdk/query-keys';
import {
  invalidateLibraryCatalogDependencies,
  patchItemAcrossScopeCaches,
  removeItemsFromScopeCaches,
  getCachedItemsMapFromScope,
} from './cache-patcher.queries';
import {
  type PollRunOutcome,
  type PollIngestionRunOptions,
  type TrackedIdentifierIngestionOptions,
  pollIngestionRunCompletion,
  buildIdentifierIngestionPayload,
  executeTrackedIdentifierIngestion,
  lookupAcademicIdentifierDirect,
} from './ingestion-polling.queries';

export {
  ingestKeys,
  feedKeys,
  curationKeys,
  retractionKeys,
  type PollRunOutcome,
  type PollIngestionRunOptions,
  type TrackedIdentifierIngestionOptions,
  pollIngestionRunCompletion,
  buildIdentifierIngestionPayload,
  executeTrackedIdentifierIngestion,
  lookupAcademicIdentifierDirect,
};

export function executeLibraryIngestion(
  scopeId: string | undefined,
  payload: UnifiedIngestionPayload,
  options?: Parameters<typeof IngestionService.ingest>[2],
) {
  return IngestionService.ingest(scopeId, payload, options);
}

export function fetchIngestionRunStatus(scopeId: string | undefined, runId: string) {
  return IngestionService.getRunStatus(scopeId, runId);
}

export function fetchIngestionRunProgress(scopeId: string | undefined, runId: string) {
  return IngestionService.getRunProgress(scopeId, runId);
}

export const feedsTransportBindings = {
  getSubscriptions: () => FeedsService.getSubscriptions(),
  subscribe: (payload: Parameters<typeof FeedsService.subscribe>[0]) =>
    FeedsService.subscribe(payload),
  updateSubscription: (
    id: string,
    payload: Parameters<typeof FeedsService.updateSubscription>[1],
  ) => FeedsService.updateSubscription(id, payload),
  unsubscribe: (id: string) => FeedsService.unsubscribe(id),
  markItemRead: (entryId: string, isRead: boolean) =>
    FeedsService.markItemRead(entryId, isRead),
  markAllRead: (entryIds: string[]) => FeedsService.markAllRead(entryIds),
  getItems: (feedId: string) => FeedsService.getItems(feedId),
};

export function useTrackedIdentifierIngestion(scopeId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (
      options: Omit<TrackedIdentifierIngestionOptions, 'queryClient' | 'scopeId'> & {
        scopeId?: string;
      },
    ) =>
      executeTrackedIdentifierIngestion({
        scopeId: options.scopeId || scopeId,
        queryClient,
        ...options,
      }),
    [scopeId, queryClient],
  );
}

// ── Curation & Duplicates Queries ─────────────────────────────────────────────

export function useDuplicateGroups(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: curationKeys.duplicates(scopeId),
    queryFn: () =>
      CurationService.getDuplicates(scopeId, {
        cachedItemsById: getCachedItemsMapFromScope(queryClient, scopeId),
      }),
    enabled: options?.enabled ?? true,
    gcTime: 3 * 60 * 1000,
  });
}

export function useMergeDuplicates(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: ({
      primaryItemId,
      duplicateItemIds,
      overrides,
    }: {
      primaryItemId: string;
      duplicateItemIds: string[];
      overrides?: Record<string, unknown>;
    }) => {
      return CurationService.mergeDuplicates(
        effectiveScope,
        primaryItemId,
        duplicateItemIds,
        overrides,
      );
    },
    onSuccess: (
      data: Awaited<ReturnType<typeof CurationService.mergeDuplicates>>,
      variables,
    ) => {
      if (data?.primaryItem) {
        patchItemAcrossScopeCaches(
          queryClient,
          effectiveScope,
          variables.primaryItemId,
          data.primaryItem as Record<string, unknown>,
        );
      }
      const deletedIds =
        Array.isArray(data?.softDeletedItemIds) && data.softDeletedItemIds.length > 0
          ? data.softDeletedItemIds
          : variables.duplicateItemIds;
      removeItemsFromScopeCaches(queryClient, effectiveScope, deletedIds);
      notifyDraftCacheCleared(variables.primaryItemId);
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemId: variables.primaryItemId,
        itemsList: true,
        counts: true,
        tags: true,
        collections: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
      const count = data.mergedCount ?? 1;
      toast.success('Duplicates merged', {
        description: `Consolidated ${count} duplicate record(s) into master. Notes and citations preserved.`,
        id: 'library-merge',
      });
    },
    onError: (error: Error) => {
      toast.error('Merge failed', {
        description: error.message || 'Unable to consolidate duplicate records.',
        id: 'library-merge',
      });
    },
  });
}

export function useBatchMergeDuplicates(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  return useMutation({
    mutationFn: (
      merges: Array<{
        primaryItemId: string;
        duplicateItemIds: string[];
        fieldSelections?: Record<string, string>;
      }>,
    ) => CurationService.mergeDuplicatesBatch(effectiveScope, merges),
    onSuccess: (data, variables) => {
      const allDeletedIds = new Set<string>();
      (data?.results ?? []).forEach((res) => {
        if (res.primaryItem) {
          patchItemAcrossScopeCaches(
            queryClient,
            effectiveScope,
            res.primaryItem.id,
            res.primaryItem as Record<string, unknown>,
          );
        }
        (res.softDeletedItemIds ?? []).forEach((id) => allDeletedIds.add(id));
      });
      if (allDeletedIds.size === 0) {
        variables.forEach((m) => m.duplicateItemIds.forEach((id) => allDeletedIds.add(id)));
      }
      if (allDeletedIds.size > 0) {
        removeItemsFromScopeCaches(queryClient, effectiveScope, Array.from(allDeletedIds));
      }
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        counts: true,
        tags: true,
        collections: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
      const groupsCount = data?.mergedGroups ?? variables.length;
      const failedCount = data?.failedGroups?.length ?? 0;
      if (failedCount > 0 && groupsCount > 0) {
        toast.warning('Partial duplicate merge completed', {
          description: `Consolidated ${groupsCount} group(s), ${failedCount} group(s) could not be merged.`,
          id: 'library-merge',
        });
      } else if (failedCount > 0 && groupsCount === 0) {
        toast.error('Batch merge failed', {
          description: data?.failedGroups?.[0]?.error || 'Unable to consolidate selected duplicate groups.',
          id: 'library-merge',
        });
      } else {
        toast.success('Duplicate groups merged', {
          description: `Consolidated ${groupsCount} duplicate group(s). Notes and citations preserved.`,
          id: 'library-merge',
        });
      }
    },
  });
}

export function useFeedArticlesQuery(
  scopeId: string,
  feedUrl: string | undefined,
  options?: { enabled?: boolean },
) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: feedKeys.articles(effectiveScope, feedUrl),
    queryFn: async () => {
      const res = await IngestionService.fetchFeed(feedUrl!, false);
      const entries = Array.isArray(res?.entries) ? res.entries : [];
      const readIds: string[] = [];
      entries.forEach((entry, idx) => {
        if (entry?.isRead === true) {
          const entryId = entry.id || (entry as { url?: string }).url || entry.link || `feed-item-${idx}`;
          if (entryId) readIds.push(entryId);
        }
      });
      if (readIds.length > 0) {
        notifyReadEntriesHydrated(readIds);
      }
      return res;
    },
    enabled: Boolean((options?.enabled ?? true) && feedUrl),
    staleTime: 2 * 60 * 1000,
  });
}

export function useFetchFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      param: string | { url: string; forceRefresh?: boolean; silent?: boolean },
    ) => {
      const url = typeof param === 'string' ? param : param.url;
      const forceRefresh = typeof param === 'object' ? param.forceRefresh : false;
      const res = await IngestionService.fetchFeed(url, forceRefresh);
      const entries = Array.isArray(res?.entries) ? res.entries : [];
      const readIds: string[] = [];
      entries.forEach((entry, idx) => {
        if (entry?.isRead === true) {
          const entryId = entry.id || (entry as { url?: string }).url || entry.link || `feed-item-${idx}`;
          if (entryId) readIds.push(entryId);
        }
      });
      if (readIds.length > 0) {
        notifyReadEntriesHydrated(readIds);
      }
      return res;
    },
    onSuccess: (res, variables) => {
      const url = typeof variables === 'string' ? variables : variables.url;
      queryClient.setQueriesData(
        {
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[1] === 'feeds' &&
            ((q.queryKey[2] === 'articles' && q.queryKey[3] === (url || '')) ||
              (q.queryKey[3] === 'articles' && q.queryKey[4] === (url || 'none'))),
        },
        res,
      );
    },
    onError: (error: Error, variables) => {
      if (typeof variables === 'object' && variables?.silent) return;
      toast.error('Failed to fetch feed', {
        description: error.message || 'Could not load feed from URL.',
        id: 'feed-fetch',
      });
    },
  });
}

// ── Feed Subscriptions Queries & Mutations (TanStack Query + Store Sync) ─────

export function useFeedSubscriptionsQuery(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const cacheKey = feedKeys.subscriptions();
  return useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<SavedFeedSubscription[]>(
        queryClient,
        'user',
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      const res = await FeedsService.getSubscriptions();
      if (res?.data && Array.isArray(res.data)) {
        const mappedFeeds = mapServerFeedSubscriptions(res.data);
        notifyServerFeedsHydrated(mappedFeeds);
        return mappedFeeds;
      }
      return invokeLoadFeedsFallback({ force: true });
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSubscribeFeedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      url,
      retentionDays,
      cleanupReadAfter,
      cleanupUnreadAfter,
    }: {
      name: string;
      url: string;
      retentionDays?: SavedFeedSubscription['retentionDays'];
      cleanupReadAfter?: SavedFeedSubscription['cleanupReadAfter'];
      cleanupUnreadAfter?: SavedFeedSubscription['cleanupUnreadAfter'];
    }): Promise<SavedFeedSubscription> =>
      await invokeAddFeed(name, url, retentionDays, {
        cleanupReadAfter,
        cleanupUnreadAfter,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feedKeys.subscriptions() });
    },
  });
}

export function useUpdateFeedSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        name?: string;
        url?: string;
        retentionDays?: SavedFeedSubscription['retentionDays'];
        cleanupReadAfter?: SavedFeedSubscription['cleanupReadAfter'];
        cleanupUnreadAfter?: SavedFeedSubscription['cleanupUnreadAfter'];
      };
    }): Promise<void> => {
      await invokeUpdateFeed(id, updates);
    },
    onSuccess: () => {
      queryClient.setQueryData(feedKeys.subscriptions(), getRegisteredFeedsSnapshot());
    },
  });
}

export function useUnsubscribeFeedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await invokeRemoveFeed(id);
    },
    onSuccess: () => {
      queryClient.setQueryData(feedKeys.subscriptions(), getRegisteredFeedsSnapshot());
    },
  });
}

export function useImportOpmlFeedsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opmlXml: string) => {
      const res = await FeedsService.importOpml(opmlXml);
      if (res?.data?.subscriptions && Array.isArray(res.data.subscriptions)) {
        const mappedFeeds = mapServerFeedSubscriptions(res.data.subscriptions);
        notifyServerFeedsHydrated(mappedFeeds);
      }
      return res?.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feedKeys.subscriptions() });
    },
  });
}

export function useExportOpmlFeedsMutation() {
  return useMutation({
    mutationFn: async () => {
      const res = await FeedsService.exportOpml();
      return res?.data;
    },
  });
}

export function useIngestMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (payload: UnifiedIngestionPayload) => {
      const res = await IngestionService.ingest(effectiveScope, payload);
      const resObj = (res ?? {}) as {
        data?: { runId?: string; status?: string };
        runId?: string;
        status?: string;
        _polled?: boolean;
      };
      const runId = resObj.data?.runId || resObj.runId;
      const initialStatus = String(
        resObj.data?.status || resObj.status || '',
      ).toUpperCase();
      const isAlreadyDone =
        initialStatus === 'COMPLETED' ||
        initialStatus === 'READY' ||
        initialStatus === 'PARTIAL' ||
        initialStatus === 'DUPLICATE';
      if (runId && !isAlreadyDone) {
        const outcome = await pollIngestionRunCompletion(effectiveScope, runId);
        if (outcome.status === 'FAILED' || outcome.status === 'BLOCKED') {
          throw new Error(outcome.error || 'Ingestion run failed to complete');
        }
        if (res && typeof res === 'object') {
          (res as { _polled?: boolean })._polled = true;
        }
      }
      return res;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      const colId = (variables as { collectionId?: string })?.collectionId;
      if (colId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveScope, colId),
        });
      }
      invalidateCollections(queryClient, effectiveScope);
    },
  });
}

export function useDismissDuplicatesMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  return useMutation({
    mutationFn: (itemIds: string[]) =>
      CurationService.dismissDuplicates(effectiveScope, itemIds),
    onSuccess: (_data, itemIds) => {
      if (Array.isArray(itemIds) && itemIds.length > 0) {
        notifyDraftCacheCleared(itemIds[0]);
      } else {
        notifyDraftCacheCleared();
      }
      queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
  });
}

const invalidateRetraction = (qc: QueryClient, scopeId?: string) => {
  const effectiveScope = normalizeScopeId(scopeId);
  qc.invalidateQueries({ queryKey: retractionKeys.all(effectiveScope) });
  qc.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
  qc.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
};

export function useRetractedItems(scopeId?: string, enabled = true) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: retractionKeys.items(effectiveScope),
    queryFn: () => RetractionService.getRetractedItems(effectiveScope),
    enabled,
    staleTime: 1000 * 60 * 60,
  });
}

export function useRetraction(scopeId?: string, options?: { includeItems?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const statsQuery = useQuery({
    queryKey: retractionKeys.stats(effectiveScope),
    queryFn: () => RetractionService.getStats(effectiveScope),
    enabled: true,
    staleTime: 1000 * 60 * 60,
  });
  const itemsQuery = useRetractedItems(
    effectiveScope,
    (options?.includeItems ?? true) && Boolean(effectiveScope),
  );
  const checkItemMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.checkItem(effectiveScope, itemId),
    onSuccess: (data) => {
      invalidateRetraction(queryClient, scopeId);
      if (data.status === 'unknown') {
        toast.info('Could not verify this item', {
          description: 'Retraction status needs a DOI or PMID, or the lookup was unavailable. The stored status was not changed.',
          id: 'retraction-check',
        });
      } else if (data.isRetracted) {
        toast.error('Retraction detected!', {
          description: `This publication was flagged as ${data.nature || 'retracted'}.`,
          id: 'retraction-check',
        });
      } else {
        toast.success('Retraction check complete', {
          description: 'No retraction notices found for this item.',
          id: 'retraction-check',
        });
      }
    },
    onError: (err: Error) => toast.error('Check failed', { description: err.message, id: 'retraction-check' }),
  });
  const checkLibraryMutation = useMutation({
    mutationFn: (itemIds?: string[]) => RetractionService.checkLibrary(effectiveScope, itemIds),
    onSuccess: (res) => {
      invalidateRetraction(queryClient, scopeId);
      if (res.newlyRetracted > 0) {
        toast.warning(`Scan completed: ${res.newlyRetracted} retracted item(s) found!`, {
          description: `Scanned ${res.scanned} publications in this library.`,
          id: 'retraction-scan',
        });
      } else {
        toast.success(`Scan completed: All ${res.scanned} publications clear`, {
          description: 'No new retracted items detected.',
          id: 'retraction-scan',
        });
      }
    },
    onError: (err: Error) => toast.error('Library scan failed', { description: err.message, id: 'retraction-scan' }),
  });
  const flagMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: FlagRetractionInput }) =>
      RetractionService.flagItem(effectiveScope, itemId, data),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.warning('Item flagged as retracted', { id: 'retraction-flag' });
    },
    onError: (err: Error) => toast.error('Failed to flag item', { description: err.message, id: 'retraction-flag' }),
  });
  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.unflagItem(effectiveScope, itemId),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.success('Retraction flag removed', { id: 'retraction-flag' });
    },
    onError: (err: Error) => toast.error('Failed to remove flag', { description: err.message, id: 'retraction-flag' }),
  });
  const syncLibraryMutation = useMutation({
    mutationFn: (syncOptions?: { maxDays?: number; limit?: number }) =>
      RetractionService.syncLibrary(effectiveScope, syncOptions),
    onSuccess: (res) => {
      invalidateRetraction(queryClient, scopeId);
      if (res.newlyRetracted > 0) {
        toast.warning(`Retraction sync: ${res.newlyRetracted} retracted item(s) found!`, {
          description: `Scanned ${res.scanned} publications in this library.`,
          id: 'retraction-sync',
        });
      } else {
        toast.success(`Retraction sync complete: ${res.scanned} publications verified`, {
          id: 'retraction-sync',
        });
      }
    },
    onError: (err: Error) =>
      toast.error('Retraction sync failed', { description: err.message, id: 'retraction-sync' }),
  });
  return {
    stats: statsQuery.data,
    retractedItems: itemsQuery.data || [],
    checkItem: checkItemMutation.mutateAsync,
    checkLibrary: checkLibraryMutation.mutateAsync,
    syncLibrary: syncLibraryMutation.mutateAsync,
    flagItem: flagMutation.mutateAsync,
    unflagItem: unflagMutation.mutateAsync,
    isCheckingItem: checkItemMutation.isPending,
    isCheckingLibrary: checkLibraryMutation.isPending,
    isUnflagging: unflagMutation.isPending,
  };
}

export function useSyncExternalBibtexMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  return useMutation({
    mutationFn: async ({
      bibtex: providedBibtex,
      provider = 'zotero',
      remoteCollectionId,
      collectionId,
      remoteCollectionName,
    }: {
      bibtex?: string;
      provider?: 'zotero' | 'mendeley';
      remoteCollectionId?: string;
      collectionId?: string;
      remoteCollectionName: string;
    }) => {
      let bibtex = providedBibtex;
      if (!bibtex && remoteCollectionId) {
        const fetched = await integrationService.getCollectionBibtex(provider, remoteCollectionId);
        bibtex = fetched.bibtex;
      }
      if (!bibtex || !bibtex.trim()) {
        return { empty: true };
      }
      const res = await IngestionService.ingest(effectiveScope, { source: 'bibtex', content: bibtex, collectionId });
      const resRecord = res as { data?: { runId?: string }; runId?: string } | null;
      const runId = resRecord?.data?.runId || resRecord?.runId;
      if (runId) {
        const pollOutcome = await pollIngestionRunCompletion(effectiveScope, runId, { fallbackTitle: remoteCollectionName, maxWaitMs: 90000 });
        if (!pollOutcome.ok) throw new Error(pollOutcome.error || 'Ingestion run failed to complete');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
        invalidateCollections(queryClient, effectiveScope),
      ]);
      return res;
    },
  });
}
