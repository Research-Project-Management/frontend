'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryServices, IngestionService } from '../library.client';
import type { UnifiedIngestionPayload, FlagRetractionInput } from '@/features/library/domain/types/library.types';
import { mapServerFeedSubscriptions } from '@/features/library/domain/feed-parser.domain';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';
import {
  libraryKeys,
  itemKeys,
  ingestKeys,
  feedKeys,
  curationKeys,
  retractionKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  invalidateLibraryCatalogDependencies,
  patchItemAcrossScopeCaches,
  removeItemsFromScopeCaches,
  getCachedItemsMapFromScope,
} from './cache-patcher';
import {
  notifyServerFeedsHydrated,
  notifyReadEntriesHydrated,
  invokeLoadFeedsFallback,
  invokeAddFeed,
  invokeUpdateFeed,
  invokeRemoveFeed,
  getRegisteredFeedsSnapshot,
  notifyDraftCacheCleared,
} from './feed-hydration.port';
import {
  type PollRunOutcome,
  type PollIngestionRunOptions,
  type TrackedIdentifierIngestionOptions,
  pollIngestionRunCompletion,
  buildIdentifierIngestionPayload,
  executeTrackedIdentifierIngestion,
} from './ingestion-polling.workflow';

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
};

export function useTrackedIdentifierIngestion(scopeId: string) {
  const queryClient = useQueryClient();
  return (options: Omit<TrackedIdentifierIngestionOptions, 'queryClient' | 'scopeId'> & { scopeId?: string }) =>
    executeTrackedIdentifierIngestion({
      scopeId: options.scopeId || scopeId,
      queryClient,
      ...options,
    });
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
      libraryServices.curation.getDuplicates(scopeId, {
        cachedItemsById: getCachedItemsMapFromScope(queryClient, scopeId),
      }),
    enabled: options?.enabled ?? true,
    gcTime: 3 * 60 * 1000,
  });
}

export function useLibraryIntegrityReport(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: curationKeys.integrity(effectiveScope),
    queryFn: () => libraryServices.curation.getIntegrityReport(effectiveScope),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export const useQualityAudit = useLibraryIntegrityReport;

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
      return libraryServices.curation.mergeDuplicates(
        effectiveScope,
        primaryItemId,
        duplicateItemIds,
        overrides,
      );
    },
    onSuccess: (
      data: Awaited<ReturnType<typeof libraryServices.curation.mergeDuplicates>>,
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

export function useAcademicFeedArticlesQuery(
  scopeId: string,
  feedUrl: string | undefined,
  options?: { enabled?: boolean },
) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: feedKeys.articles(effectiveScope, feedUrl),
    queryFn: async () => {
      const res = await libraryServices.ingestion.fetchFeed(feedUrl!, false);
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

export function useFetchAcademicFeed() {
  return useMutation({
    mutationFn: async (
      param: string | { url: string; forceRefresh?: boolean; silent?: boolean },
    ) => {
      const url = typeof param === 'string' ? param : param.url;
      const forceRefresh = typeof param === 'object' ? param.forceRefresh : false;
      const res = await libraryServices.ingestion.fetchFeed(url, forceRefresh);
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
  return useQuery({
    queryKey: feedKeys.subscriptions(),
    queryFn: async () => {
      const res = await libraryServices.feeds.getSubscriptions();
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

export function usePreviewCaptureUrlMutation(scopeId?: string) {
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (urlOrInput: string | { url: string; scopeId?: string }) => {
      const targetUrl = typeof urlOrInput === 'string' ? urlOrInput : urlOrInput.url;
      const targetScope =
        typeof urlOrInput === 'object' && urlOrInput.scopeId
          ? normalizeScopeId(urlOrInput.scopeId)
          : effectiveScope;
      return libraryServices.ingestion.captureUrl(targetScope, targetUrl);
    },
    onError: (error: Error) => {
      toast.error('Failed to preview URL', {
        description: error.message || 'Could not extract metadata from URL.',
        id: 'capture-url-preview',
      });
    },
  });
}

export interface ConfirmCaptureUrlInput {
  url: string;
  previewToken: string;
  title?: string;
  abstract?: string;
  doi?: string;
  year?: number;
  publicationTitle?: string;
  itemType?: string;
  collectionId?: string;
  scopeId?: string;
}

export function useConfirmCaptureUrlMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (payload: ConfirmCaptureUrlInput) => {
      const { scopeId: overrideScope, ...confirmPayload } = payload;
      const targetScope = overrideScope ? normalizeScopeId(overrideScope) : effectiveScope;
      return libraryServices.ingestion.confirmUrl(targetScope, confirmPayload);
    },
    onSuccess: (_data, variables) => {
      const targetScope = variables.scopeId ? normalizeScopeId(variables.scopeId) : effectiveScope;
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(targetScope) });
      if (variables.collectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, variables.collectionId),
        });
      }
      invalidateCollections(queryClient, targetScope);
    },
    onError: (error: Error) => {
      toast.error('Failed to save captured URL', {
        description: error.message || 'Could not confirm URL import.',
        id: 'capture-url-confirm',
      });
    },
  });
}

export function useIngestMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (payload: UnifiedIngestionPayload) =>
      libraryServices.ingestion.ingest(effectiveScope, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
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
      libraryServices.curation.dismissDuplicates(effectiveScope, itemIds),
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

export const invalidateRetraction = (qc: QueryClient, scopeId?: string) => {
  const effectiveScope = normalizeScopeId(scopeId);
  qc.invalidateQueries({ queryKey: retractionKeys.all(effectiveScope) });
  qc.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
  qc.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
};

export function useRetractedItems(scopeId?: string, enabled = true) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: retractionKeys.items(effectiveScope),
    queryFn: () => libraryServices.retraction.getRetractedItems(effectiveScope),
    enabled,
    staleTime: 1000 * 60 * 60,
  });
}

export function useRetraction(scopeId?: string, options?: { includeItems?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const statsQuery = useQuery({
    queryKey: retractionKeys.stats(effectiveScope),
    queryFn: () => libraryServices.retraction.getStats(effectiveScope),
    enabled: true,
    staleTime: 1000 * 60 * 60,
  });
  const itemsQuery = useRetractedItems(
    effectiveScope,
    (options?.includeItems ?? true) && Boolean(effectiveScope),
  );
  const checkItemMutation = useMutation({
    mutationFn: (itemId: string) => libraryServices.retraction.checkItem(effectiveScope, itemId),
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
    mutationFn: (itemIds?: string[]) => libraryServices.retraction.checkLibrary(effectiveScope, itemIds),
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
      libraryServices.retraction.flagItem(effectiveScope, itemId, data),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.warning('Item flagged as retracted', { id: 'retraction-flag' });
    },
    onError: (err: Error) => toast.error('Failed to flag item', { description: err.message, id: 'retraction-flag' }),
  });
  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => libraryServices.retraction.unflagItem(effectiveScope, itemId),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.success('Retraction flag removed', { id: 'retraction-flag' });
    },
    onError: (err: Error) => toast.error('Failed to remove flag', { description: err.message, id: 'retraction-flag' }),
  });
  const syncLibraryMutation = useMutation({
    mutationFn: (syncOptions?: { maxDays?: number; limit?: number }) =>
      libraryServices.retraction.syncLibrary(effectiveScope, syncOptions),
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
    isLoadingStats: statsQuery.isLoading,
    isLoadingItems: itemsQuery.isLoading,
    checkItem: checkItemMutation.mutateAsync,
    checkLibrary: checkLibraryMutation.mutateAsync,
    syncLibrary: syncLibraryMutation.mutateAsync,
    flagItem: flagMutation.mutateAsync,
    unflagItem: unflagMutation.mutateAsync,
    isCheckingItem: checkItemMutation.isPending,
    isCheckingLibrary: checkLibraryMutation.isPending,
    isSyncingLibrary: syncLibraryMutation.isPending,
    isFlagging: flagMutation.isPending,
    isUnflagging: unflagMutation.isPending,
  };
}

export function useSyncExternalBibtexMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  return useMutation({
    mutationFn: async ({ bibtex, collectionId, remoteCollectionName }: { bibtex: string; collectionId?: string; remoteCollectionName: string }) => {
      const res = await IngestionService.ingest(effectiveScope, { source: 'bibtex', content: bibtex, collectionId });
      const resRecord = res as { data?: { runId?: string }; runId?: string } | null;
      const runId = resRecord?.data?.runId || resRecord?.runId;
      if (runId) {
        const pollOutcome = await pollIngestionRunCompletion(effectiveScope, runId, { fallbackTitle: remoteCollectionName, maxWaitMs: 90000 });
        if (!pollOutcome.ok) throw new Error(pollOutcome.error || 'Ingestion run failed to complete');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
        queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) }),
        invalidateCollections(queryClient, effectiveScope),
      ]);
      return res;
    },
  });
}
