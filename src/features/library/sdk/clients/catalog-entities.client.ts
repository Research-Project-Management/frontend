import type {
  Collection,
  CreateCollectionDto,
  UpdateCollectionDto,
  TagWithCount,
  Note,
  CreateNoteDTO,
  UpdateNoteDTO,
  ExtractNotesOptions,
  ItemStateData,
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchResultsResponse,
  SavedSearchPreviewResponse,
  SavedSearchConditionGroup,
  SavedSearchScopeOptions,
  SearchResponse,
  SearchSortBy,
  SearchSortOrder,
} from '@/features/library/types/core.types';
import {
  libraryClient,
  resolveLibraryUrl,
  getBasePath,
  getCatalogUrl,
  getExportsUrl,
  getSyncUrl,
  isProjectScope,
  mapBackendItem,
} from './http.client';

export type {
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchConditionGroup,
  ItemStateData,
  ExtractNotesOptions,
  CreateNoteDTO,
  UpdateNoteDTO,
};

// 2. CollectionsService
export const CollectionsService = {
  getAll: (spaceId?: string) =>
    libraryClient.get<{ collections: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections', spaceId),
    ),

  list: (spaceId?: string) => CollectionsService.getAll(spaceId),

  getById: (spaceId?: string, collectionId?: string) => {
    const effectiveScope = collectionId ? spaceId : undefined;
    const effectiveId = collectionId || spaceId || '';
    return libraryClient.get<{ collection: Collection }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(effectiveId)}`, effectiveScope),
    );
  },

  get: (spaceId: string | undefined, collectionId: string) =>
    CollectionsService.getById(spaceId, collectionId),

  create: (spaceId: string | undefined, data: CreateCollectionDto) =>
    libraryClient.post<{ collection: Collection }>(
      resolveLibraryUrl('catalog', '/collections', spaceId),
      data,
    ),

  update: (spaceId: string | undefined, collectionId: string, data: UpdateCollectionDto) =>
    libraryClient.put<{ collection: Collection }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}`, spaceId),
      data,
    ),

  delete: (spaceId: string | undefined, collectionId: string, strategy?: 'cascade' | 'move-to-parent' | 'orphan') =>
    libraryClient.delete(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}`, spaceId),
      strategy ? { params: { strategy } } : undefined,
    ),

  copy: (
    spaceId: string | undefined,
    collectionId: string,
    data?: { parentId?: string | null },
  ) =>
    libraryClient.post<{ collection: Collection; copiedCount?: number }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/copy`, spaceId),
      data ?? {},
    ),

  moveItems: (
    spaceId: string | undefined,
    collectionId: string,
    itemIds: string[],
    sourceCollectionId?: string | null,
  ) =>
    libraryClient.post<{ message: string; count: number; targetCollectionId: string | null }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/move-items`, spaceId),
      {
        itemIds,
        ...(sourceCollectionId ? { sourceCollectionId } : {}),
      },
    ),

  reorder: (
    spaceId: string | undefined,
    collections: Array<{ id: string; parentId?: string | null; orderIndex?: number }>,
  ) =>
    libraryClient.patch<{ collections: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections/reorder', spaceId),
      { collections },
    ),

  assignItems: (
    spaceId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    libraryClient.post<{ success?: boolean; count: number; collectionId?: string }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items`, spaceId),
      { itemIds },
    ),

  removeItem: (
    spaceId: string | undefined,
    collectionId: string,
    itemId: string,
  ) => CollectionsService.detachItem(spaceId, collectionId, itemId),

  detachItem: (
    spaceId: string | undefined,
    collectionId: string,
    itemId: string,
  ) =>
    libraryClient.delete<{ success?: boolean; detached?: boolean }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`, spaceId),
    ),

  bulkDetachItems: (
    spaceId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    libraryClient.post<{ success: boolean; count: number }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items/bulk-detach`, spaceId),
      { itemIds },
    ),

  exportBibtex: (spaceId: string | undefined, collectionId: string) =>
    libraryClient.get<{ bibtex: string; total: number; filename: string }>(
      `${getExportsUrl(spaceId)}?format=bibtex&collectionId=${encodeURIComponent(collectionId)}`,
    ),

  exportBundle: (spaceId: string | undefined, collectionId: string) =>
    libraryClient.get<{
      collection: { id: string; name: string };
      totalItems?: number;
      filesIncluded?: number;
      totalFiles?: number;
      bibtex: string;
      files: Array<{ itemId?: string; title: string; filename: string; fileUrl: string }>;
    }>(
      getExportsUrl(spaceId, `${encodeURIComponent(collectionId)}/export-bundle`),
    ),
};

// 3. TagsService
function getTagsUrl(spaceId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/tags', spaceId, suffix);
}

export const TagsService = {
  list: async (spaceId?: string): Promise<TagWithCount[]> => {
    const raw = await libraryClient.get<
      TagWithCount[] | { data?: TagWithCount[]; tags?: TagWithCount[] }
    >(getTagsUrl(spaceId));
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.tags)) return raw.tags;
      if (Array.isArray(raw.data)) return raw.data;
    }
    return [];
  },

  create: async (
    spaceId: string | undefined,
    name: string,
    color?: string,
    type: string = 'manual',
    shortcut?: number | null,
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.post<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(spaceId),
      {
        name,
        color,
        type,
        ...(shortcut !== undefined ? { shortcut } : {}),
        ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
      },
    );
    if (raw && typeof raw === 'object') {
      if ('tag' in raw && raw.tag) return raw.tag;
      if ('data' in raw && raw.data) return raw.data;
    }
    return raw as TagWithCount;
  },

  update: async (
    spaceId: string | undefined,
    tagId: string,
    data: { name?: string; color?: string; type?: string; shortcut?: number | null },
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.patch<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(spaceId, encodeURIComponent(tagId)),
      data,
    );
    if (raw && typeof raw === 'object') {
      if ('tag' in raw && raw.tag) return raw.tag;
      if ('data' in raw && raw.data) return raw.data;
    }
    return raw as TagWithCount;
  },

  rename: (spaceId: string | undefined, tagId: string, name: string) =>
    TagsService.update(spaceId, tagId, { name }),

  delete: async (spaceId: string | undefined, tagId: string): Promise<void> => {
    await libraryClient.delete<unknown>(getTagsUrl(spaceId, encodeURIComponent(tagId)));
  },

  deleteAutomatic: async (spaceId?: string): Promise<{ count: number }> => {
    const raw = await libraryClient.delete<{ count?: number; data?: { count: number } }>(
      getTagsUrl(spaceId, 'automatic'),
    );
    return raw?.data || (raw && typeof raw.count === 'number' ? { count: raw.count } : { count: 0 });
  },

  split: async (
    spaceId: string | undefined,
    tagId: string,
    parts: string[],
  ): Promise<{ tags: TagWithCount[]; count: number }> => {
    const raw = await libraryClient.post<{
      tags?: TagWithCount[];
      count?: number;
      data?: { tags?: TagWithCount[]; count?: number };
    }>(getTagsUrl(spaceId, `${encodeURIComponent(tagId)}/split`), {
      parts,
      ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
    });
    const tags = raw?.tags || raw?.data?.tags || [];
    return {
      tags,
      count: raw?.count ?? raw?.data?.count ?? tags.length,
    };
  },
};

// 4. NotesService
function getNotesUrl(spaceId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/notes', spaceId, suffix);
}

function unwrapNoteResponse(
  raw: Note | { success?: boolean; data?: Note; note?: Note; literatureNote?: Note },
): Note {
  if (raw && typeof raw === 'object') {
    if ('data' in raw && raw.data) return raw.data;
    if ('note' in raw && raw.note) return raw.note;
    if ('literatureNote' in raw && raw.literatureNote) return raw.literatureNote;
  }
  return raw as Note;
}

export const NotesService = {
  list: async (spaceId?: string, itemId?: string): Promise<Note[]> => {
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', itemId);
    if (isProjectScope(spaceId)) params.set('spaceId', spaceId!);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const raw = await libraryClient.get<Note[] | { success?: boolean; data?: Note[]; notes?: Note[] }>(
      `${getNotesUrl(spaceId)}${queryString}`,
    );

    if (Array.isArray(raw)) {
      return raw;
    }
    return (raw && typeof raw === 'object' ? (raw.data || raw.notes) : []) || [];
  },

  get: async (spaceId: string | undefined, id: string): Promise<Note> => {
    const raw = await libraryClient.get<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(spaceId, encodeURIComponent(id)),
    );
    return unwrapNoteResponse(raw);
  },

  create: async (spaceId: string | undefined, dto: CreateNoteDTO): Promise<Note> => {
    const raw = await libraryClient.post<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(spaceId),
      {
        ...dto,
        ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
      },
    );
    return unwrapNoteResponse(raw);
  },

  update: async (
    spaceId: string | undefined,
    id: string,
    expectedVersion: number | undefined,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const raw = await libraryClient.patch<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(spaceId, encodeURIComponent(id)),
      {
        ...dto,
        expectedVersion,
      },
    );
    return unwrapNoteResponse(raw);
  },

  delete: async (
    spaceId: string | undefined,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await libraryClient.delete<{ deleted?: boolean; data?: { deleted: boolean } }>(
      `${getNotesUrl(spaceId, encodeURIComponent(id))}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },

  extractFromAnnotations: async (
    spaceId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<Partial<Note> & { totalExtracted: number; note?: Note; message?: string }> => {
    const endpoint = `${getBasePath(spaceId)}/notes/items/${encodeURIComponent(itemId)}/from-annotations`;
    const raw = await libraryClient.post<
      | Note
      | {
          success?: boolean;
          data?: Note;
          note?: Note;
          literatureNote?: Note;
          totalExtracted?: number;
          message?: string;
        }
    >(endpoint, options || {});
    const note = unwrapNoteResponse(raw);
    const rawObj = raw && typeof raw === 'object' ? (raw as { totalExtracted?: number; message?: string }) : undefined;
    const totalExtracted =
      typeof rawObj?.totalExtracted === 'number'
        ? rawObj.totalExtracted
        : note && (note as { id?: string }).id
          ? 1
          : 0;
    return {
      ...(note || {}),
      totalExtracted,
      note: note && (note as { id?: string }).id ? note : undefined,
      message: rawObj?.message,
    };
  },

  extractNotes: (
    spaceId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<Partial<Note> & { totalExtracted: number; note?: Note; message?: string }> =>
    NotesService.extractFromAnnotations(spaceId, itemId, options),
};

// 5. StateService
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

// 6. SavedSearchesService
export const SavedSearchesService = {
  getAll: (spaceId?: string) =>
    libraryClient.get<SavedSearch[]>(
      resolveLibraryUrl('catalog', '/saved-searches', spaceId),
    ),

  list: (spaceId?: string) => SavedSearchesService.getAll(spaceId),

  getById: (spaceId: string | undefined, id: string) =>
    libraryClient.get<SavedSearch>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, spaceId),
    ),

  create: (spaceId: string | undefined, data: CreateSavedSearchInput) => {
    const effectiveScope =
      (data as { targetScope?: string; scope?: string })?.targetScope ||
      (data as { scope?: string })?.scope ||
      spaceId;
    const { targetScope: _, scope: __, ...payload } = data;
    return libraryClient.post<SavedSearch>(
      resolveLibraryUrl('catalog', '/saved-searches', effectiveScope),
      {
        ...payload,
        ...(isProjectScope(effectiveScope) ? { spaceId: effectiveScope } : {}),
      },
    );
  },

  update: (spaceId: string | undefined, id: string, data: UpdateSavedSearchInput) => {
    const effectiveScope =
      (data as { targetScope?: string; scope?: string })?.targetScope ||
      (data as { scope?: string })?.scope ||
      spaceId;
    const { targetScope: _, scope: __, ...payload } = data;
    return libraryClient.patch<SavedSearch>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, effectiveScope),
      payload,
    );
  },

  delete: (spaceId: string | undefined, id: string) =>
    libraryClient.delete<{ success: boolean; id: string }>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, spaceId),
    ),

  preview: (
    spaceId: string | undefined,
    conditions: SavedSearchConditionGroup,
    options?: { sortBy?: string; sortOrder?: 'asc' | 'desc'; scopeOptions?: SavedSearchScopeOptions },
  ): Promise<SavedSearchPreviewResponse> =>
    libraryClient
      .post<SavedSearchPreviewResponse>(
        resolveLibraryUrl('catalog', '/saved-searches/preview', spaceId),
        {
          conditions,
          ...(options?.sortBy ? { sortBy: options.sortBy } : {}),
          ...(options?.sortOrder ? { sortOrder: options.sortOrder } : {}),
          ...(options?.scopeOptions || conditions.scopeOptions ? { scopeOptions: options?.scopeOptions || conditions.scopeOptions } : {}),
          ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
        },
      )
      .then((res) => ({
        ...res,
        sampleItems: Array.isArray(res?.sampleItems)
          ? res.sampleItems.map((it) => mapBackendItem(it))
          : [],
      })),

  getResults: (
    spaceId: string | undefined,
    id: string,
    params?: {
      limit?: number;
      page?: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ): Promise<SavedSearchResultsResponse> =>
    libraryClient
      .get<SavedSearchResultsResponse>(
        resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}/execute`, spaceId),
        params ? { params } : undefined,
      )
      .then((res) => ({
        ...res,
        items: Array.isArray(res?.items)
          ? res.items.map((it) => mapBackendItem(it))
          : [],
      })),

  execute: (spaceId: string | undefined, id: string, params?: { page?: number; limit?: number }) =>
    SavedSearchesService.getResults(spaceId, id, params),
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

