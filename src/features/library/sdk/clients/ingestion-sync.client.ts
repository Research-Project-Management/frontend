import {
  type Item,
  type SearchResponse,
  type SearchSortBy,
  type SearchSortOrder,
  type DuplicateGroup,
  type LibraryIntegrityReport,
  type FlagRetractionInput,
  type RetractionStats,
  type UnifiedIngestionPayload,
  type UnifiedIngestionResponse,
  type IngestionRunSnapshotResponse,
  type UrlCapturePreviewResponse,
  UnifiedIngestionPayloadSchema,
  UnifiedIngestionResponseSchema,
  UrlCapturePreviewResponseSchema,
  IngestionRunSnapshotResponseSchema,
  itemSchema,
} from '@/features/library/domain/types/library.types';
import { preserveMappedItemFlags } from '@/features/library/domain/metadata';
import {
  libraryClient,
  resolveLibraryUrl,
  getIngestionUrl,
  getCurationUrl,
  getRetractionUrl,
  getSyncUrl,
  toIngestionSubmission,
  isProjectScope,
  mapBackendItem,
} from './http.client';
import { ItemsService } from './items.client';

// 10. Ingestion, Curation & Retraction Services
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
    return (res && typeof res === 'object' && 'data' in res && res.data ? res.data : res) as import('@/features/library/domain/types/batch-upload.types').IngestionProgressResponse;
  },

  captureUrl: async (scopeId: string | undefined, url: string): Promise<UrlCapturePreviewResponse> => {
    const res = await libraryClient.post<Record<string, unknown>>(
      getIngestionUrl(scopeId, 'capture-url'),
      { url },
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return UrlCapturePreviewResponseSchema.parse(enveloped);
  },

  confirmUrl: (
    scopeId: string | undefined,
    payload: {
      url: string;
      previewToken: string;
      title?: string;
      abstract?: string;
      doi?: string;
      year?: number;
      publicationTitle?: string;
      itemType?: string;
      collectionId?: string;
    },
  ) =>
    libraryClient.post<{ id: string; title: string; doi?: string; year?: number; citationKey?: string }>(
      getIngestionUrl(scopeId, 'confirm-url'),
      {
        ...payload,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    ),

  fetchFeed: async (
    url: string,
    forceRefresh = false,
  ): Promise<{
    feedTitle: string;
    entries: Array<{
      id?: string;
      title: string;
      authors: string[];
      published?: string;
      summary?: string;
      doi?: string;
      arxivId?: string;
      link?: string;
      isRead?: boolean;
      isSaved?: boolean;
      savedItemId?: string | null;
    }>;
  }> => {
    const res = await libraryClient.post<{
      feedTitle?: string;
      entries?: Array<{
        id?: string;
        title: string;
        authors: string[];
        published?: string;
        summary?: string;
        doi?: string;
        arxivId?: string;
        link?: string;
        isRead?: boolean;
        isSaved?: boolean;
        savedItemId?: string | null;
      }>;
      data?: {
        feedTitle?: string;
        entries?: Array<{
          id?: string;
          title: string;
          authors: string[];
          published?: string;
          summary?: string;
          doi?: string;
          arxivId?: string;
          link?: string;
          isRead?: boolean;
          isSaved?: boolean;
          savedItemId?: string | null;
        }>;
      };
    }>(getIngestionUrl(undefined, 'fetch-feed'), { url, forceRefresh });
    const payload = res && typeof res === 'object' && 'data' in res && res.data ? res.data : res;
    return {
      feedTitle: payload?.feedTitle || 'Academic Feed',
      entries: Array.isArray(payload?.entries) ? payload.entries : [],
    };
  },
};

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
): Promise<Map<string, Item>> {
  const hydratedMap = new Map<string, Item>(seedItems);
  const unresolvedIds = Array.from(missingIds).filter((id) => !hydratedMap.has(id));
  if (unresolvedIds.length === 0) return hydratedMap;

  if (unresolvedIds.length === 1) {
    const singleId = unresolvedIds[0]!;
    try {
      const fetched = await ItemsService.getById(scopeId, singleId);
      if (fetched) hydratedMap.set(singleId, fetched);
    } catch {
      // fallback: keep existing stub if lookup fails
    }
    return hydratedMap;
  }

  try {
    const listRes = await ItemsService.getAll(scopeId, {
      limit: Math.max(250, unresolvedIds.length * 2),
    });
    for (const item of listRes?.items || []) {
      if (item?.id && missingIds.has(item.id)) {
        hydratedMap.set(item.id, item);
      }
    }
  } catch {
    // fallback: keep existing data if batch list fails
  }

  return hydratedMap;
}

export const CurationService = {
  getDuplicates: async (
    scopeId?: string,
    options?: { cachedItemsById?: ReadonlyMap<string, Item> },
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
      matchType: c.matchReason === 'EXACT_DOI' ? 'DOI' : 'TITLE_AUTHOR_YEAR',
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

  undoMerge: async (
    scopeId: string | undefined,
    primaryItemId: string,
  ): Promise<{ restoredPrimaryId: string; restoredDuplicateIds: string[] }> => {
    interface UndoMergeApiResponse {
      restoredPrimaryId?: string;
      restoredDuplicateIds?: string[];
      data?: {
        restoredPrimaryId?: string;
        restoredDuplicateIds?: string[];
      };
    }
    const res = await libraryClient.post<UndoMergeApiResponse>(
      getCurationUrl(scopeId, 'undo-merge'),
      {
        primaryItemId,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
    const payload = res?.data ?? res;
    return {
      restoredPrimaryId: payload?.restoredPrimaryId ?? primaryItemId,
      restoredDuplicateIds: Array.isArray(payload?.restoredDuplicateIds)
        ? payload.restoredDuplicateIds
        : [],
    };
  },

  getIntegrityReport: async (scopeId?: string): Promise<LibraryIntegrityReport> => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    const res = await libraryClient.get<LibraryIntegrityReport & { averageQualityScore?: number; healthScorePercentage?: number }>(
      `${getCurationUrl(scopeId, 'integrity')}${pQuery}`,
    );
    const score = res?.averageQualityScore ?? res?.healthScorePercentage ?? 100;
    return {
      ...res,
      averageQualityScore: score,
      healthScorePercentage: res?.healthScorePercentage ?? score,
    };
  },

  dismissDuplicate: (scopeId: string | undefined, itemAId: string, itemBId: string) =>
    libraryClient.post<{ dismissed: boolean; itemIds: string[] }>(
      getCurationUrl(scopeId, 'duplicates/dismiss'),
      {
        itemIds: [itemAId, itemBId],
      },
    ),

  dismissDuplicates: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient.post<{ dismissed: boolean; itemIds: string[] }>(
      getCurationUrl(scopeId, 'duplicates/dismiss'),
      { itemIds },
    ),
};

export const RetractionService = {
  getStats: (scopeId?: string) =>
    libraryClient.get<RetractionStats>(getRetractionUrl(scopeId, 'stats')),

  getDatabaseStats: (scopeId?: string) =>
    libraryClient.get<{
      totalRecords?: number;
      lastSeededAt?: string | null;
      status?: string;
      [key: string]: unknown;
    }>(getRetractionUrl(scopeId, 'database/stats')),

  seedDatabase: (force = false, scopeId?: string) =>
    libraryClient.post<{
      seeded?: boolean;
      insertedCount?: number;
      totalRecords?: number;
      [key: string]: unknown;
    }>(getRetractionUrl(scopeId, 'database/seed'), { force }),

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

// 11. Search & Sync Services
export const SearchService = {
  search: (params: {
    query?: string;
    q?: string;
    limit?: number;
    cursor?: string;
    collectionId?: string;
    tagId?: string;
    itemType?: string;
    yearFrom?: number;
    yearTo?: number;
    sortBy?: SearchSortBy;
    sortOrder?: SearchSortOrder;
    includeFacets?: boolean;
  }, scopeId?: string): Promise<SearchResponse> => {
    const effectiveQuery = params.query ?? params.q ?? '';
    const queryParams: Record<string, string> = { query: effectiveQuery };
    if (params.limit !== undefined) queryParams.limit = String(params.limit);
    if (params.cursor) queryParams.cursor = params.cursor;
    if (params.collectionId) queryParams.collectionId = params.collectionId;
    if (params.tagId) queryParams.tagId = params.tagId;
    if (params.itemType) queryParams.itemType = params.itemType;
    if (params.yearFrom !== undefined) queryParams.yearFrom = String(params.yearFrom);
    if (params.yearTo !== undefined) queryParams.yearTo = String(params.yearTo);
    if (params.sortBy) queryParams.sortBy = params.sortBy;
    if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
    if (params.includeFacets !== undefined) queryParams.includeFacets = String(params.includeFacets);

    return libraryClient
      .get<SearchResponse>(
        resolveLibraryUrl('search', '/search', scopeId),
        { params: queryParams },
      )
      .then((res) => ({
        ...res,
        items: Array.isArray(res?.items)
          ? res.items.map((it) => mapBackendItem(it))
          : [],
      }));
  },

  searchAnchors: (attachmentId: string, term: string, pageIndex?: number, scopeId?: string) => {
    const params: Record<string, string> = { term };
    if (pageIndex !== undefined) params.pageIndex = String(pageIndex);
    return libraryClient.get<Array<{
      pageIndex: number;
      text: string;
      startOffset?: number;
      endOffset?: number;
      highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
    }>>(
      resolveLibraryUrl(
        'search',
        `/search/attachments/${encodeURIComponent(attachmentId)}/anchors`,
        scopeId,
      ),
      { params },
    );
  },
};

export const SyncService = {
  getDiagnostics: (scopeId?: string) =>
    libraryClient.get<unknown>(getSyncUrl(scopeId, 'diagnostics')),

  getVersion: (scopeId?: string) =>
    libraryClient.get<{ version: string; scope: 'user' | 'project'; scopeId: string }>(getSyncUrl(scopeId, 'version')),

  getChanges: (scopeId?: string, params?: { since?: string; limit?: number; compact?: boolean }) =>
    libraryClient.get<{
      since: string;
      count: number;
      compacted?: boolean;
      hasMore: boolean;
      nextCursor?: string | null;
      nextSince?: string | null;
      changes: Array<Record<string, unknown>>;
    }>(
      getSyncUrl(scopeId, 'changes'),
      {
        params: {
          since: params?.since ?? '0',
          limit: params?.limit ?? 100,
          ...(params?.compact !== undefined ? { compact: params.compact } : {}),
        },
      },
    ),

  getTombstones: (scopeId?: string, params?: { since?: string; limit?: number }) =>
    libraryClient.get<{ since: string; count: number; hasMore: boolean; tombstones: Array<Record<string, unknown>> }>(
      getSyncUrl(scopeId, 'tombstones'),
      {
        params: {
          ...(params?.since !== undefined ? { since: params.since } : {}),
          limit: params?.limit ?? 100,
        },
      },
    ),
};


export interface FeedSubscriptionResponse {
  id: string;
  userId?: string;
  feedId?: string;
  customTitle?: string | null;
  cleanupReadAfter?: number;
  cleanupUnreadAfter?: number;
  feed?: {
    id: string;
    url: string;
    title: string;
    siteUrl?: string | null;
    description?: string | null;
    lastFetchedAt?: string | null;
  };
}

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

  getItems: (feedId: string, params?: { readStatus?: 'read' | 'unread' | 'all'; limit?: number }) =>
    libraryClient.get<{ data: unknown[] }>(resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/items`), { params }),

  markItemRead: (itemId: string, isRead = true) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', `/feeds/items/${encodeURIComponent(itemId)}/read`), { isRead }),

  markAllRead: (itemIds: string[]) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', '/feeds/items/mark-all-read'), { itemIds }),
};
