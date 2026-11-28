import type {
  ItemStateData,
  SearchResponse,
  SearchSortBy,
  SearchSortOrder,
} from '@/features/library/types/core.types';
import {
  libraryClient,
  resolveLibraryUrl,
  getCatalogUrl,
  getSyncUrl,
  isProjectScope,
  mapBackendItem,
} from './http.client';

export type { ItemStateData };

function unwrapState<T>(res: T | { data: T } | null | undefined): T | null {
  if (!res) return null;
  if (typeof res === 'object' && 'data' in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}


export const StateService = {
  getState: async (spaceId?: string, itemId?: string): Promise<ItemStateData | null> => {
    if (!itemId) return null;
    const res = await libraryClient.get<ItemStateData | { data: ItemStateData }>(
      getCatalogUrl(spaceId, `${encodeURIComponent(itemId)}/state`),
    );
    return unwrapState(res);
  },

  updateState: async (
    spaceId?: string,
    itemId?: string,
    data?: Partial<ItemStateData>,
  ): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const res = await libraryClient.patch<ItemStateData | { data: ItemStateData }>(
      getCatalogUrl(spaceId, `${encodeURIComponent(itemId)}/state`),
      data ?? {},
    );
    return unwrapState(res) ?? ({} as ItemStateData);
  },

  markAsRead: async (spaceId?: string, itemId?: string): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const res = await libraryClient.post<ItemStateData | { data: ItemStateData }>(
      getCatalogUrl(spaceId, `${encodeURIComponent(itemId)}/state/mark-read`),
      {},
    );
    return unwrapState(res) ?? ({} as ItemStateData);
  },
};



export const SearchService = {
  search: (
    params: {
      query?: string;
      q?: string;
      searchMode?: string;
      view?: string;
      limit?: number;
      page?: number;
      cursor?: string;
      collectionId?: string;
      includeSubcollections?: boolean;
      tagId?: string;
      tag?: string;
      itemType?: string;
      type?: string;
      yearFrom?: number;
      yearTo?: number;
      fromYear?: number;
      toYear?: number;
      hasFile?: boolean;
      hasNotes?: boolean;
      readStatus?: string;
      sortBy?: SearchSortBy | string;
      sortOrder?: SearchSortOrder | string;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      includeFacets?: boolean;
    },
    spaceId?: string,
    options?: { signal?: AbortSignal },
  ): Promise<SearchResponse> => {
    const effectiveQuery = params.query ?? params.q ?? '';
    const queryParams: Record<string, string> = { query: effectiveQuery };
    if (params.searchMode) queryParams.searchMode = params.searchMode;
    if (params.view) queryParams.view = params.view;
    if (params.limit !== undefined) queryParams.limit = String(params.limit);
    if (params.page !== undefined) queryParams.page = String(params.page);
    if (params.cursor) queryParams.cursor = params.cursor;
    if (params.collectionId) queryParams.collectionId = params.collectionId;
    if (params.includeSubcollections !== undefined) {
      queryParams.includeSubcollections = String(params.includeSubcollections);
    }
    if (params.tagId) queryParams.tagId = params.tagId;
    if (params.tag) queryParams.tag = params.tag;
    const effectiveItemType = params.itemType ?? params.type;
    if (effectiveItemType) queryParams.itemType = effectiveItemType;
    const effectiveYearFrom = params.yearFrom ?? params.fromYear;
    if (effectiveYearFrom !== undefined) {
      queryParams.yearFrom = String(effectiveYearFrom);
    }
    const effectiveYearTo = params.yearTo ?? params.toYear;
    if (effectiveYearTo !== undefined) {
      queryParams.yearTo = String(effectiveYearTo);
    }
    if (params.hasFile !== undefined) {
      queryParams.hasFile = String(params.hasFile);
    }
    if (params.hasNotes !== undefined) {
      queryParams.hasNotes = String(params.hasNotes);
    }
    if (params.readStatus) queryParams.readStatus = params.readStatus;
    const effectiveSortBy = params.sortBy ?? params.orderBy;
    if (effectiveSortBy) queryParams.sortBy = String(effectiveSortBy);
    const effectiveSortOrder = params.sortOrder ?? params.orderDirection;
    if (effectiveSortOrder) queryParams.sortOrder = String(effectiveSortOrder);
    if (params.includeFacets !== undefined) {
      queryParams.includeFacets = String(params.includeFacets);
    }

    return libraryClient
      .get<SearchResponse>(
        resolveLibraryUrl('search', '/search', spaceId),
        { params: queryParams, signal: options?.signal },
      )
      .then((res) => ({
        ...res,
        items: Array.isArray(res?.items)
          ? res.items.map((it) => mapBackendItem(it))
          : [],
      }));
  },

  searchAnchors: (
    attachmentId: string,
    term: string,
    pageIndex?: number,
    spaceId?: string,
    options?: { signal?: AbortSignal },
  ) => {
    const params: Record<string, string> = { term };
    if (pageIndex !== undefined) params.pageIndex = String(pageIndex);
    return libraryClient
      .get<
        Array<{
          attachmentId?: string;
          pageIndex: number;
          snippet?: string;
          text?: string;
          charOffsetStart?: number;
          charOffsetEnd?: number;
          startOffset?: number;
          endOffset?: number;
          highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
        }>
      >(
        resolveLibraryUrl(
          'search',
          `/search/attachments/${encodeURIComponent(attachmentId)}/anchors`,
          spaceId,
        ),
        { params, signal: options?.signal },
      )
      .then((rows) =>
        (Array.isArray(rows) ? rows : []).map((row) => {
          const snippet = row.snippet ?? row.text ?? '';
          const charOffsetStart = row.charOffsetStart ?? row.startOffset ?? 0;
          const charOffsetEnd = row.charOffsetEnd ?? row.endOffset ?? charOffsetStart;
          return {
            attachmentId: row.attachmentId ?? attachmentId,
            pageIndex: row.pageIndex,
            snippet,
            text: snippet,
            charOffsetStart,
            charOffsetEnd,
            startOffset: charOffsetStart,
            endOffset: charOffsetEnd,
            highlightBoxes: row.highlightBoxes,
          };
        }),
      );
  },
};

export const SyncService = {
  getVersion: (spaceId?: string) =>
    libraryClient.get<{ version: string; scope: 'user' | 'project'; spaceId: string }>(getSyncUrl(spaceId, 'version')),

  getChanges: (spaceId?: string, params?: { since?: string; limit?: number; compact?: boolean }) =>
    libraryClient.get<{
      since: string;
      count: number;
      compacted?: boolean;
      hasMore: boolean;
      nextCursor?: string | null;
      nextSince?: string | null;
      changes: Array<Record<string, unknown>>;
    }>(
      getSyncUrl(spaceId, 'changes'),
      {
        params: {
          since: params?.since ?? '0',
          limit: params?.limit ?? 100,
          ...(params?.compact !== undefined ? { compact: params.compact } : {}),
        },
      },
    ),
};

