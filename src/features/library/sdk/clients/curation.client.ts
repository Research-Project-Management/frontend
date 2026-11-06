import { type Item, type DuplicateGroup, type FlagRetractionInput, type RetractionStats, itemSchema, type UnifiedIngestionPayload, type UnifiedIngestionResponse, type IngestionRunSnapshotResponse, type FeedSubscriptionResponse, UnifiedIngestionPayloadSchema, UnifiedIngestionResponseSchema, IngestionRunSnapshotResponseSchema } from '@/features/library/types/core.types';
import { preserveMappedItemFlags } from '@/features/library/domain/metadata.mapper';
import {
  resolveFeedVirtualizationPlan,
  mapOpenAlexWorksToFeedEntries,
  mapCrossRefWorksToFeedEntries,
  mapEuropePmcWorksToFeedEntries,
  type FeedEntryApiItem,
} from '@/features/library/domain/feed-parser.domain';
import { libraryClient, resolveLibraryUrl, getCurationUrl, getRetractionUrl, isProjectScope, mapBackendItem, getIngestionUrl, toIngestionSubmission } from './http.client';

const CLIENT_FEED_CACHE_PREFIX = 'flux:feed-cache:v1:';
const CLIENT_FEED_TTL_MS = 60 * 60 * 1000; // 60 minutes local SWR freshness window

interface CachedBrowserFeedSnapshot {
  feedTitle: string;
  entries: FeedEntryApiItem[];
  fetchedAt: number;
}

function readBrowserFeedSnapshot(feedUrl: string): CachedBrowserFeedSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(`${CLIENT_FEED_CACHE_PREFIX}${feedUrl.trim()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBrowserFeedSnapshot;
    if (
      parsed &&
      typeof parsed.fetchedAt === 'number' &&
      Array.isArray(parsed.entries) &&
      parsed.entries.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeBrowserFeedSnapshot(
  feedUrl: string,
  feedTitle: string,
  entries: FeedEntryApiItem[],
): void {
  if (typeof window === 'undefined' || !window.localStorage || entries.length === 0) return;
  try {
    const payload: CachedBrowserFeedSnapshot = {
      feedTitle,
      entries: entries.slice(0, 60),
      fetchedAt: Date.now(),
    };
    window.localStorage.setItem(
      `${CLIENT_FEED_CACHE_PREFIX}${feedUrl.trim()}`,
      JSON.stringify(payload),
    );
  } catch {
    // Quota exceeded or private browsing — non-fatal
  }
}

interface RawDuplicateCluster {
  clusterId: string;
  matchReason: string;
  confidence: number;
  recommendedMasterId?: string;
  items: Array<Record<string, unknown> | string>;
}

function extractRawDuplicateItemId(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    const rec = raw as { id?: unknown; itemId?: unknown };
    const id = String(rec.id || rec.itemId || '').trim();
    return id || undefined;
  }
  return undefined;
}

function hasDuplicateItemTitle(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      'title' in raw &&
      typeof (raw as { title: unknown }).title === 'string' &&
      (raw as { title: string }).title.trim().length > 0,
  );
}

function normalizeDuplicateClusterItem(
  rawItem: Record<string, unknown> | string,
  hydratedMap: ReadonlyMap<string, Item>,
): Item {
  const id = extractRawDuplicateItemId(rawItem);
  const hydrated = id ? hydratedMap.get(id) : undefined;
  const sourceObj: Record<string, unknown> = {
    ...(typeof rawItem === 'object' && rawItem !== null ? rawItem : { id }),
    ...(hydrated ? (hydrated as unknown as Record<string, unknown>) : {}),
  };

  const rawTags = Array.isArray(sourceObj.tags)
    ? sourceObj.tags
        .map((t: unknown) =>
          typeof t === 'string'
            ? t
            : t && typeof t === 'object' && 'name' in t
              ? String((t as { name: unknown }).name)
              : '',
        )
        .filter(Boolean)
    : undefined;
  const baseMapped = mapBackendItem(sourceObj);
  const mapped = {
    ...baseMapped,
    ...(rawTags ? { tags: rawTags } : {}),
  };
  const parseRes = itemSchema.safeParse(mapped);
  return preserveMappedItemFlags(baseMapped, {
    ...mapped,
    ...(parseRes.success ? parseRes.data : {}),
  });
}

async function batchHydrateMissingDuplicateItems(
  scopeId: string | undefined,
  missingIds: ReadonlySet<string>,
  seedItems?: ReadonlyMap<string, Item>,
  fetchItemsByIds?: (ids: string[]) => Promise<Item[]>,
): Promise<Map<string, Item>> {
  const hydratedMap = new Map<string, Item>(seedItems);
  const unresolvedIds = Array.from(missingIds).filter((id) => !hydratedMap.has(id));
  if (unresolvedIds.length === 0) return hydratedMap;

  try {
    if (fetchItemsByIds) {
      const items = await fetchItemsByIds(unresolvedIds);
      for (const item of items || []) {
        if (item?.id && missingIds.has(item.id)) {
          hydratedMap.set(item.id, item);
        }
      }
      return hydratedMap;
    }

    const res = await libraryClient.get<
      Item[] | { items?: Item[]; data?: Item[] | { items?: Item[] } }
    >(resolveLibraryUrl('catalog', '/items', scopeId), {
      params: {
        ids: unresolvedIds.join(','),
        limit: Math.max(250, unresolvedIds.length * 2),
      },
    });
    const rawItems = Array.isArray(res)
      ? res
      : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray((res?.data as { items?: Item[] } | undefined)?.items)
            ? (res!.data as { items: Item[] }).items
            : [];
    for (const raw of rawItems) {
      const item = mapBackendItem(raw as unknown as Record<string, unknown>);
      if (item?.id && missingIds.has(item.id)) {
        hydratedMap.set(item.id, item);
      }
    }
  } catch {
    // fallback: keep existing data if batch list fails
  }

  return hydratedMap;
}

function mapMatchReasonToType(reason?: string): DuplicateGroup['matchType'] {
  switch (reason) {
    case 'EXACT_DOI':
      return 'DOI';
    case 'EXACT_ARXIV':
      return 'ARXIV';
    case 'EXACT_PMID':
      return 'PMID';
    case 'EXACT_ISBN':
      return 'ISBN';
    case 'INGESTION_SUSPECT':
      return 'INGESTION_SUSPECT';
    default:
      return 'TITLE_AUTHOR_YEAR';
  }
}

export const CurationService = {
  getDuplicates: async (
    scopeId?: string,
    options?: {
      cachedItemsById?: ReadonlyMap<string, Item>;
      fetchItemsByIds?: (ids: string[]) => Promise<Item[]>;
    },
  ): Promise<{ duplicateGroups: DuplicateGroup[]; totalDuplicates: number }> => {
    const res = await libraryClient.get<
      | RawDuplicateCluster[]
      | {
          data?: RawDuplicateCluster[];
          clusters?: RawDuplicateCluster[];
          duplicates?: DuplicateGroup[];
        }
    >(getCurationUrl(scopeId, 'duplicates'));

    if (res && typeof res === 'object' && 'duplicates' in res && Array.isArray(res.duplicates)) {
      const groups = res.duplicates as DuplicateGroup[];
      const missingIds = new Set<string>();
      for (const g of groups) {
        for (const it of g.items || []) {
          if (it.id && !it.title) missingIds.add(it.id);
        }
      }
      if (missingIds.size > 0) {
        const hydratedMap = await batchHydrateMissingDuplicateItems(
          scopeId,
          missingIds,
          options?.cachedItemsById,
          options?.fetchItemsByIds,
        );
        for (const g of groups) {
          g.items = (g.items || []).map((it) => {
            const hydrated = it.id ? hydratedMap.get(it.id) : undefined;
            return hydrated ? preserveMappedItemFlags(hydrated, { ...it, ...hydrated }) : it;
          });
        }
      }
      return {
        duplicateGroups: groups,
        totalDuplicates: groups.reduce((acc, g) => acc + (g.items?.length || 0), 0),
      };
    }

    const clusters: RawDuplicateCluster[] = Array.isArray(res)
      ? res
      : res && 'data' in res && Array.isArray(res.data)
        ? res.data
        : res && 'clusters' in res && Array.isArray(res.clusters)
          ? res.clusters
          : [];

    const missingItemIds = new Set<string>();
    for (const c of clusters) {
      for (const it of c.items || []) {
        const id = extractRawDuplicateItemId(it);
        if (id && !hasDuplicateItemTitle(it)) {
          missingItemIds.add(id);
        }
      }
    }

    const hydratedItemsMap = await batchHydrateMissingDuplicateItems(
      scopeId,
      missingItemIds,
      options?.cachedItemsById,
    );

    const duplicateGroups: DuplicateGroup[] = clusters.map((c) => ({
      matchType: mapMatchReasonToType(c.matchReason),
      matchReason: c.matchReason,
      confidence: c.confidence >= 1 ? 'high' : 'medium',
      key: c.clusterId,
      ...(c.recommendedMasterId ? { recommendedMasterId: c.recommendedMasterId } : {}),
      items: (c.items || []).map((it) => normalizeDuplicateClusterItem(it, hydratedItemsMap)),
    }));

    return {
      duplicateGroups,
      totalDuplicates: duplicateGroups.reduce((acc, g) => acc + (g.items?.length || 0), 0),
    };
  },

  mergeDuplicates: async (
    scopeId: string | undefined,
    primaryItemId: string,
    duplicateItemIds: string[],
    fieldSelections?: Record<string, unknown>,
  ) => {
    interface MergeApiResponse {
      primaryItem?: unknown;
      masterItem?: unknown;
      mergedCount?: number;
      softDeletedItemIds?: string[];
      data?: {
        primaryItem?: unknown;
        masterItem?: unknown;
        mergedCount?: number;
        softDeletedItemIds?: string[];
      };
    }
    const res = await libraryClient.post<MergeApiResponse>(
      getCurationUrl(scopeId, 'merge'),
      {
        primaryItemId,
        duplicateItemIds,
        fieldSelections,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
    const rawMaster =
      res?.primaryItem ||
      res?.masterItem ||
      res?.data?.primaryItem ||
      res?.data?.masterItem;
    const primaryItem = rawMaster ? mapBackendItem(rawMaster as Record<string, unknown>) : undefined;
    const mergedCount = res?.mergedCount ?? res?.data?.mergedCount ?? duplicateItemIds.length;
    const softDeletedItemIds =
      res?.softDeletedItemIds ||
      res?.data?.softDeletedItemIds ||
      [];
    return {
      success: true,
      primaryItem,
      mergedCount,
      softDeletedItemIds,
    };
  },

  mergeDuplicatesBatch: async (
    scopeId: string | undefined,
    merges: Array<{
      primaryItemId: string;
      duplicateItemIds: string[];
      fieldSelections?: Record<string, string>;
    }>,
  ) => {
    interface BatchMergePayload {
      success?: boolean;
      mergedGroups?: number;
      mergedGroupCount?: number;
      mergedItems?: number;
      totalMergedItems?: number;
      results?: Array<{
        primaryItem?: Record<string, unknown>;
        masterItem?: Record<string, unknown>;
        mergedCount?: number;
        softDeletedItemIds?: string[];
      }>;
      failedGroups?: Array<{ primaryItemId: string; error: string }>;
    }
    const res = await libraryClient.post<BatchMergePayload & { data?: BatchMergePayload }>(
      getCurationUrl(scopeId, 'merge-batch'),
      {
        merges,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
    const payload: BatchMergePayload = res?.data ?? res ?? {};
    const results = (payload.results ?? []).map((r) => {
      const raw = r.primaryItem || r.masterItem;
      return {
        primaryItem: raw ? mapBackendItem(raw) : undefined,
        mergedCount: r.mergedCount ?? 0,
        softDeletedItemIds: r.softDeletedItemIds ?? [],
      };
    });
    const mergedGroups =
      payload.mergedGroups ?? payload.mergedGroupCount ?? results.length;
    const mergedItems =
      payload.mergedItems ??
      payload.totalMergedItems ??
      results.reduce((s, r) => s + r.mergedCount, 0);
    return {
      success: payload.success ?? (payload.failedGroups?.length ?? 0) === 0,
      mergedGroups,
      mergedItems,
      results,
      failedGroups: payload.failedGroups ?? [],
    };
  },

  dismissDuplicates: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient.post<{ dismissed: boolean; itemIds: string[] }>(
      getCurationUrl(scopeId, 'duplicates/dismiss'),
      { itemIds },
    ),
};

export const RetractionService = {
  getStats: (scopeId?: string) =>
    libraryClient.get<RetractionStats>(getRetractionUrl(scopeId, 'stats')),

  getRetractedItems: (scopeId?: string): Promise<Item[]> =>
    libraryClient
      .get<Item[] | { items?: Item[]; data?: Item[] }>(
        getRetractionUrl(scopeId, 'items'),
        { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
      )
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res?.items ?? res?.data ?? [];
        return list.map((it) => mapBackendItem(it));
      }),

  checkItem: (scopeId: string | undefined, itemId: string) =>
    libraryClient.post<{
      itemId: string;
      isRetracted: boolean;
      status?: 'retracted' | 'clean' | 'unknown';
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      getRetractionUrl(scopeId, `items/${encodeURIComponent(itemId)}/check`),
      {},
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  checkLibrary: (scopeId: string | undefined, itemIds?: string[]) =>
    libraryClient.post<{ scanned: number; newlyRetracted: number }>(
      getRetractionUrl(scopeId, 'check-all'),
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  syncLibrary: (
    scopeId: string | undefined,
    options?: { maxDays?: number; limit?: number },
  ) =>
    libraryClient.post<{
      scanned: number;
      newlyRetracted: number;
      checkedCount?: number;
      [key: string]: unknown;
    }>(
      getRetractionUrl(scopeId, 'sync'),
      options || {},
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  flagItem: (
    scopeId: string | undefined,
    itemId: string,
    data?: FlagRetractionInput,
  ): Promise<Item> =>
    libraryClient
      .post<Item | { item: Item }>(
        getRetractionUrl(scopeId, `items/${encodeURIComponent(itemId)}/flag`),
        data || {},
        { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
      )
      .then((res) =>
        mapBackendItem(
          (res && typeof res === 'object' && 'item' in res
            ? (res as { item: Item }).item
            : res) as Partial<Item>,
        ),
      ),

  unflagItem: (scopeId: string | undefined, itemId: string): Promise<Item> =>
    libraryClient
      .delete<Item | { item: Item }>(
        getRetractionUrl(scopeId, `items/${encodeURIComponent(itemId)}/flag`),
        { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
      )
      .then((res) =>
        mapBackendItem(
          (res && typeof res === 'object' && 'item' in res
            ? (res as { item: Item }).item
            : res) as Partial<Item>,
        ),
      ),
};

export const IngestionService = {
  ingest: async (
    scopeId: string | undefined,
    payload: UnifiedIngestionPayload,
    options?: { signal?: AbortSignal },
  ): Promise<UnifiedIngestionResponse> => {
    const validated = UnifiedIngestionPayloadSchema.parse(payload);
    const submission = {
      ...toIngestionSubmission(validated),
      ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
    };
    const res = await libraryClient.post<Record<string, unknown>>(
      getIngestionUrl(scopeId, 'submit'),
      submission,
      { timeout: 30000, signal: options?.signal },
    );
    const accepted = (res && typeof res === 'object' && 'data' in res && res.data ? res.data : res) as Record<string, unknown>;
    const rawItemId = accepted.existingItemId ?? accepted.itemId;
    return UnifiedIngestionResponseSchema.parse({
      success: true,
      data: {
        runId: accepted.runId,
        status: accepted.status,
        itemId: typeof rawItemId === 'string' && rawItemId ? rawItemId : undefined,
        deduplicated: accepted.deduplicated,
      },
    });
  },

  getRunStatus: async (scopeId: string | undefined, runId: string): Promise<IngestionRunSnapshotResponse> => {
    const res = await libraryClient.get<Record<string, unknown>>(
      getIngestionUrl(scopeId, `runs/${encodeURIComponent(runId)}`),
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return IngestionRunSnapshotResponseSchema.parse(enveloped);
  },

  getRunProgress: async (scopeId: string | undefined, runId: string) => {
    const res = await libraryClient.get<{ data?: unknown } | unknown>(
      getIngestionUrl(scopeId, `status/${encodeURIComponent(runId)}/progress`),
    );
    return (res && typeof res === 'object' && 'data' in res && res.data ? res.data : res) as import('@/features/library/types/ingestion.types').IngestionProgressResponse;
  },

  fetchFeed: async (
    url: string,
    forceRefresh = false,
  ): Promise<{
    feedTitle: string;
    entries: FeedEntryApiItem[];
  }> => {
    const trimmedUrl = (url || '').trim();
    if (!trimmedUrl) {
      return { feedTitle: 'Academic Feed', entries: [] };
    }

    // 1. Check Local-First Browser Snapshot (SWR 60-min Freshness Window)
    const cached = readBrowserFeedSnapshot(trimmedUrl);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.fetchedAt < CLIENT_FEED_TTL_MS
    ) {
      return {
        feedTitle: cached.feedTitle,
        entries: cached.entries,
      };
    }

    // 2. Client-Side Protocol Virtualization (Direct CORS Fetch from User's Browser IP)
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const plan = resolveFeedVirtualizationPlan(trimmedUrl, 30);
      if (plan.kind !== 'server-fallback') {
        try {
          const response = await window.fetch(plan.endpointUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal:
              typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
                ? AbortSignal.timeout(8_000)
                : undefined,
          });
          if (response.ok) {
            const json: unknown = await response.json();
            let virtualizedEntries: FeedEntryApiItem[] = [];
            if (plan.kind === 'openalex') {
              virtualizedEntries = mapOpenAlexWorksToFeedEntries(
                json,
                plan.primaryCategory,
              );
            } else if (plan.kind === 'crossref') {
              virtualizedEntries = mapCrossRefWorksToFeedEntries(
                json,
                plan.feedTitle,
                plan.primaryCategory,
              );
            } else if (plan.kind === 'europepmc') {
              virtualizedEntries = mapEuropePmcWorksToFeedEntries(json);
            }
            if (virtualizedEntries.length > 0) {
              writeBrowserFeedSnapshot(
                trimmedUrl,
                plan.feedTitle,
                virtualizedEntries,
              );
              return {
                feedTitle: plan.feedTitle,
                entries: virtualizedEntries,
              };
            }
          }
        } catch {
          // If client-side CORS fetch fails (e.g. strict corporate firewall), gracefully fall through
        }
      }
    }

    // 3. Server Fallback (for generic RSS/Atom blogs or when client CORS is unreachable)
    try {
      const res = await libraryClient.post<{
        feedTitle?: string;
        entries?: FeedEntryApiItem[];
        data?: {
          feedTitle?: string;
          entries?: FeedEntryApiItem[];
        };
      }>(getIngestionUrl(undefined, 'fetch-feed'), {
        url: trimmedUrl,
        forceRefresh,
      });
      const payload =
        res && typeof res === 'object' && 'data' in res && res.data
          ? res.data
          : res;
      const result = {
        feedTitle: payload?.feedTitle || cached?.feedTitle || 'Academic Feed',
        entries: Array.isArray(payload?.entries) ? payload.entries : [],
      };
      if (result.entries.length > 0) {
        writeBrowserFeedSnapshot(trimmedUrl, result.feedTitle, result.entries);
      }
      return result;
    } catch (err) {
      // Stale-if-Error: return stale browser snapshot if server is also unreachable
      if (cached && cached.entries.length > 0) {
        return {
          feedTitle: cached.feedTitle,
          entries: cached.entries,
        };
      }
      throw err;
    }
  },
};

export type { FeedSubscriptionResponse };

export const FeedsService = {
  getSubscriptions: () =>
    libraryClient.get<{ data: FeedSubscriptionResponse[] }>(
      resolveLibraryUrl('ingestion', '/feeds/subscriptions'),
    ),

  subscribe: (data: {
    url: string;
    customTitle?: string;
    cleanupDays?: number;
    cleanupReadAfter?: number;
    cleanupUnreadAfter?: number;
  }) =>
    libraryClient.post<{ data: unknown }>(resolveLibraryUrl('ingestion', '/feeds/subscriptions'), data),

  updateSubscription: (
    feedId: string,
    data: {
      customTitle?: string;
      cleanupDays?: number;
      cleanupReadAfter?: number;
      cleanupUnreadAfter?: number;
      url?: string;
    },
  ) =>
    libraryClient.patch<{ data: unknown }>(resolveLibraryUrl('ingestion', `/feeds/subscriptions/${encodeURIComponent(feedId)}`), data),

  unsubscribe: (feedId: string) =>
    libraryClient.delete<void>(resolveLibraryUrl('ingestion', `/feeds/subscriptions/${encodeURIComponent(feedId)}`)),

  getItems: (
    feedId: string,
    params?: {
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number;
      cursor?: string;
      page?: number;
      search?: string;
      forceRefresh?: boolean;
    },
  ) =>
    libraryClient.get<{
      data: unknown[];
      meta?: {
        hasNextPage: boolean;
        nextCursor: string | null;
        limit: number;
      };
      hasNextPage?: boolean;
      nextCursor?: string | null;
    }>(
      resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/items`),
      { params },
    ),

  markItemRead: (itemId: string, isRead = true) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', `/feeds/items/${encodeURIComponent(itemId)}/read`), { isRead }),

  markAllRead: (itemIds: string[]) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', '/feeds/items/mark-all-read'), { itemIds }),

  markFeedAllRead: (feedId: string) =>
    libraryClient.post<{ success: boolean; markedCount?: number }>(
      resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/mark-all-read`),
      {},
    ),

  exportOpml: () =>
    libraryClient.get<{ data: { opmlXml: string; count: number } }>(
      resolveLibraryUrl('ingestion', '/feeds/opml/export'),
    ),

  importOpml: (opmlXml: string) =>
    libraryClient.post<{
      data: {
        importedCount: number;
        totalParsed: number;
        subscriptions: FeedSubscriptionResponse[];
      };
    }>(resolveLibraryUrl('ingestion', '/feeds/opml/import'), { opmlXml }),
};

