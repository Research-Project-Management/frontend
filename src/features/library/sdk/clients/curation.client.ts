import {
  type Item,
  type DuplicateGroup,
  type FlagRetractionInput,
  type RetractionStats,
  itemSchema,
} from '@/features/library/types/core.types';
import { preserveMappedItemFlags } from '@/features/library/domain/metadata/mapper';
import {
  libraryClient,
  resolveLibraryUrl,
  getCurationUrl,
  getRetractionUrl,
  isProjectScope,
  mapBackendItem,
} from './http.client';

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
  spaceId: string | undefined,
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
    >(resolveLibraryUrl('catalog', '/items', spaceId), {
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
    spaceId?: string,
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
    >(getCurationUrl(spaceId, 'duplicates'));

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
          spaceId,
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
      spaceId,
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
    spaceId: string | undefined,
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
      getCurationUrl(spaceId, 'merge'),
      {
        primaryItemId,
        duplicateItemIds,
        fieldSelections,
        ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
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
    spaceId: string | undefined,
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
      getCurationUrl(spaceId, 'merge-batch'),
      {
        merges,
        ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
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

  dismissDuplicates: (spaceId: string | undefined, itemIds: string[]) =>
    libraryClient.post<{ dismissed: boolean; itemIds: string[] }>(
      getCurationUrl(spaceId, 'duplicates/dismiss'),
      { itemIds },
    ),
};

export const RetractionService = {
  getStats: (spaceId?: string) =>
    libraryClient.get<RetractionStats>(getRetractionUrl(spaceId, 'stats')),

  getRetractedItems: (spaceId?: string): Promise<Item[]> =>
    libraryClient
      .get<Item[] | { items?: Item[]; data?: Item[] }>(
        getRetractionUrl(spaceId, 'items'),
        { params: isProjectScope(spaceId) ? { spaceId: spaceId } : undefined },
      )
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res?.items ?? res?.data ?? [];
        return list.map((it) => mapBackendItem(it));
      }),

  checkItem: (spaceId: string | undefined, itemId: string) =>
    libraryClient.post<{
      itemId: string;
      isRetracted: boolean;
      status?: 'retracted' | 'clean' | 'unknown';
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      getRetractionUrl(spaceId, `items/${encodeURIComponent(itemId)}/check`),
      {},
      { params: isProjectScope(spaceId) ? { spaceId: spaceId } : undefined },
    ),

  checkLibrary: (spaceId: string | undefined, itemIds?: string[]) =>
    libraryClient.post<{ scanned: number; newlyRetracted: number }>(
      getRetractionUrl(spaceId, 'check-all'),
      { itemIds },
      { params: isProjectScope(spaceId) ? { spaceId: spaceId } : undefined },
    ),

  syncLibrary: (
    spaceId: string | undefined,
    options?: { maxDays?: number; limit?: number },
  ) =>
    libraryClient.post<{
      scanned: number;
      newlyRetracted: number;
      checkedCount?: number;
      [key: string]: unknown;
    }>(
      getRetractionUrl(spaceId, 'sync'),
      options || {},
      { params: isProjectScope(spaceId) ? { spaceId: spaceId } : undefined },
    ),

  flagItem: (
    spaceId: string | undefined,
    itemId: string,
    data?: FlagRetractionInput,
  ): Promise<Item> =>
    libraryClient
      .post<Item | { item: Item }>(
        getRetractionUrl(spaceId, `items/${encodeURIComponent(itemId)}/flag`),
        data || {},
        { params: isProjectScope(spaceId) ? { spaceId: spaceId } : undefined },
      )
      .then((res) =>
        mapBackendItem(
          (res && typeof res === 'object' && 'item' in res
            ? (res as { item: Item }).item
            : res) as Partial<Item>,
        ),
      ),

  unflagItem: (spaceId: string | undefined, itemId: string): Promise<Item> =>
    libraryClient
      .delete<Item | { item: Item }>(
        getRetractionUrl(spaceId, `items/${encodeURIComponent(itemId)}/flag`),
        { params: isProjectScope(spaceId) ? { spaceId: spaceId } : undefined },
      )
      .then((res) =>
        mapBackendItem(
          (res && typeof res === 'object' && 'item' in res
            ? (res as { item: Item }).item
            : res) as Partial<Item>,
        ),
      ),
};
