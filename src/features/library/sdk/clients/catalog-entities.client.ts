import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  TagWithCount,
  Note,
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
} from '@/features/library/domain/types/core.types';
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
};

export interface ExtractNotesOptions {
  protocol?: 'flux' | 'web' | 'zotero';
  webBaseUrl?: string;
  projectId?: string;
  noteId?: string;
  targetNoteId?: string;
  title?: string;
  attachmentId?: string;
  annotationIds?: string[];
  groupBy?: 'page' | 'color' | 'tag' | 'chronological';
  tagColor?: boolean | string;
  tagColorName?: string;
  includeComments?: boolean;
  includeTags?: boolean;
}

// 2. CollectionsService
export const CollectionsService = {
  getAll: (scopeId?: string) =>
    libraryClient.get<{ collections: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections', scopeId),
    ),

  list: (scopeId?: string) => CollectionsService.getAll(scopeId),

  getById: (scopeId?: string, collectionId?: string) => {
    const effectiveScope = collectionId ? scopeId : undefined;
    const effectiveId = collectionId || scopeId || '';
    return libraryClient.get<{ collection: Collection }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(effectiveId)}`, effectiveScope),
    );
  },

  get: (scopeId: string | undefined, collectionId: string) =>
    CollectionsService.getById(scopeId, collectionId),

  create: (scopeId: string | undefined, data: CreateCollectionDTO) =>
    libraryClient.post<{ collection: Collection }>(
      resolveLibraryUrl('catalog', '/collections', scopeId),
      data,
    ),

  update: (scopeId: string | undefined, collectionId: string, data: UpdateCollectionDTO) =>
    libraryClient.put<{ collection: Collection }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}`, scopeId),
      data,
    ),

  delete: (scopeId: string | undefined, collectionId: string, strategy?: 'cascade' | 'move-to-parent' | 'orphan') =>
    libraryClient.delete(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}`, scopeId),
      strategy ? { params: { strategy } } : undefined,
    ),

  copy: (
    scopeId: string | undefined,
    collectionId: string,
    data?: { parentId?: string | null },
  ) =>
    libraryClient.post<{ collection: Collection; copiedCount?: number }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/copy`, scopeId),
      data ?? {},
    ),

  moveItems: (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
    sourceCollectionId?: string | null,
  ) =>
    libraryClient.post<{ message: string; count: number; targetCollectionId: string | null }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/move-items`, scopeId),
      {
        itemIds,
        ...(sourceCollectionId ? { sourceCollectionId } : {}),
      },
    ),

  reorder: (
    scopeId: string | undefined,
    collections: Array<{ id: string; parentId?: string | null; orderIndex?: number }>,
  ) =>
    libraryClient.patch<{ collections: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections/reorder', scopeId),
      { collections },
    ),

  assignItems: (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    libraryClient.post<{ success?: boolean; count: number; collectionId?: string }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items`, scopeId),
      { itemIds },
    ),

  removeItem: (
    scopeId: string | undefined,
    collectionId: string,
    itemId: string,
  ) => CollectionsService.detachItem(scopeId, collectionId, itemId),

  detachItem: (
    scopeId: string | undefined,
    collectionId: string,
    itemId: string,
  ) =>
    libraryClient.delete<{ success?: boolean; detached?: boolean }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`, scopeId),
    ),

  bulkDetachItems: (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    libraryClient.post<{ success: boolean; count: number }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/items/bulk-detach`, scopeId),
      { itemIds },
    ),

  exportBibtex: (scopeId: string | undefined, collectionId: string) =>
    libraryClient.get<{ bibtex: string; total: number; filename: string }>(
      `${getExportsUrl(scopeId)}?format=bibtex&collectionId=${encodeURIComponent(collectionId)}`,
    ),

  exportBundle: (scopeId: string | undefined, collectionId: string) =>
    libraryClient.get<{
      collection: { id: string; name: string };
      totalItems?: number;
      filesIncluded?: number;
      totalFiles?: number;
      bibtex: string;
      files: Array<{ itemId?: string; title: string; filename: string; fileUrl: string }>;
    }>(
      getExportsUrl(scopeId, `${encodeURIComponent(collectionId)}/export-bundle`),
    ),
};

// 3. TagsService
function getTagsUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/tags', scopeId, suffix);
}

export const TagsService = {
  list: async (scopeId?: string): Promise<TagWithCount[]> => {
    const raw = await libraryClient.get<
      TagWithCount[] | { data?: TagWithCount[]; tags?: TagWithCount[] }
    >(getTagsUrl(scopeId));
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.tags)) return raw.tags;
      if (Array.isArray(raw.data)) return raw.data;
    }
    return [];
  },

  create: async (
    scopeId: string | undefined,
    name: string,
    color?: string,
    type: string = 'manual',
    shortcut?: number | null,
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.post<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(scopeId),
      {
        name,
        color,
        type,
        ...(shortcut !== undefined ? { shortcut } : {}),
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
    if (raw && typeof raw === 'object') {
      if ('tag' in raw && raw.tag) return raw.tag;
      if ('data' in raw && raw.data) return raw.data;
    }
    return raw as TagWithCount;
  },

  update: async (
    scopeId: string | undefined,
    tagId: string,
    data: { name?: string; color?: string; type?: string; shortcut?: number | null },
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.patch<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(scopeId, encodeURIComponent(tagId)),
      data,
    );
    if (raw && typeof raw === 'object') {
      if ('tag' in raw && raw.tag) return raw.tag;
      if ('data' in raw && raw.data) return raw.data;
    }
    return raw as TagWithCount;
  },

  rename: (scopeId: string | undefined, tagId: string, name: string) =>
    TagsService.update(scopeId, tagId, { name }),

  delete: async (scopeId: string | undefined, tagId: string): Promise<void> => {
    await libraryClient.delete<unknown>(getTagsUrl(scopeId, encodeURIComponent(tagId)));
  },

  deleteAutomatic: async (scopeId?: string): Promise<{ count: number }> => {
    const raw = await libraryClient.delete<{ count?: number; data?: { count: number } }>(
      getTagsUrl(scopeId, 'automatic'),
    );
    return raw?.data || (raw && typeof raw.count === 'number' ? { count: raw.count } : { count: 0 });
  },

  split: async (
    scopeId: string | undefined,
    tagId: string,
    parts: string[],
  ): Promise<{ tags: TagWithCount[]; count: number }> => {
    const raw = await libraryClient.post<{
      tags?: TagWithCount[];
      count?: number;
      data?: { tags?: TagWithCount[]; count?: number };
    }>(getTagsUrl(scopeId, `${encodeURIComponent(tagId)}/split`), {
      parts,
      ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
    });
    const tags = raw?.tags || raw?.data?.tags || [];
    return {
      tags,
      count: raw?.count ?? raw?.data?.count ?? tags.length,
    };
  },
};

// 4. NotesService
export interface CreateNoteDTO {
  itemId?: string | null;
  title?: string;
  contentJson?: Record<string, unknown> | null;
  contentMd?: string;
  tags?: string[];
}

export interface UpdateNoteDTO {
  title?: string;
  contentJson?: Record<string, unknown> | null;
  contentMd?: string;
  tags?: string[];
  expectedVersion?: number;
}

function getNotesUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/notes', scopeId, suffix);
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
  list: async (scopeId?: string, itemId?: string): Promise<Note[]> => {
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', itemId);
    if (isProjectScope(scopeId)) params.set('projectId', scopeId!);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const raw = await libraryClient.get<Note[] | { success?: boolean; data?: Note[]; notes?: Note[] }>(
      `${getNotesUrl(scopeId)}${queryString}`,
    );

    if (Array.isArray(raw)) {
      return raw;
    }
    return (raw && typeof raw === 'object' ? (raw.data || raw.notes) : []) || [];
  },

  get: async (scopeId: string | undefined, id: string): Promise<Note> => {
    const raw = await libraryClient.get<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(scopeId, encodeURIComponent(id)),
    );
    return unwrapNoteResponse(raw);
  },

  create: async (scopeId: string | undefined, dto: CreateNoteDTO): Promise<Note> => {
    const raw = await libraryClient.post<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(scopeId),
      {
        ...dto,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
    return unwrapNoteResponse(raw);
  },

  update: async (
    scopeId: string | undefined,
    id: string,
    expectedVersion: number | undefined,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const raw = await libraryClient.patch<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(scopeId, encodeURIComponent(id)),
      {
        ...dto,
        expectedVersion,
      },
    );
    return unwrapNoteResponse(raw);
  },

  delete: async (
    scopeId: string | undefined,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await libraryClient.delete<{ deleted?: boolean; data?: { deleted: boolean } }>(
      `${getNotesUrl(scopeId, encodeURIComponent(id))}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },

  extractFromAnnotations: async (
    scopeId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<Partial<Note> & { totalExtracted: number; note?: Note; message?: string }> => {
    const endpoint = `${getBasePath(scopeId)}/notes/items/${encodeURIComponent(itemId)}/from-annotations`;
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
    scopeId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<Partial<Note> & { totalExtracted: number; note?: Note; message?: string }> =>
    NotesService.extractFromAnnotations(scopeId, itemId, options),
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
  getState: async (scopeId?: string, itemId?: string): Promise<ItemStateData | null> => {
    if (!itemId) return null;
    const res = await libraryClient.get<ItemStateData | { data: ItemStateData }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/state`),
    );
    return unwrapState(res);
  },

  updateState: async (
    scopeId?: string,
    itemId?: string,
    data?: Partial<ItemStateData>,
  ): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const res = await libraryClient.patch<ItemStateData | { data: ItemStateData }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/state`),
      data ?? {},
    );
    return unwrapState(res) ?? ({} as ItemStateData);
  },

  markAsRead: async (scopeId?: string, itemId?: string): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const res = await libraryClient.post<ItemStateData | { data: ItemStateData }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/state/mark-read`),
      {},
    );
    return unwrapState(res) ?? ({} as ItemStateData);
  },
};

// 6. SavedSearchesService
export const SavedSearchesService = {
  getAll: (scopeId?: string) =>
    libraryClient.get<SavedSearch[]>(
      resolveLibraryUrl('catalog', '/saved-searches', scopeId),
    ),

  list: (scopeId?: string) => SavedSearchesService.getAll(scopeId),

  getById: (scopeId: string | undefined, id: string) =>
    libraryClient.get<SavedSearch>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, scopeId),
    ),

  create: (scopeId: string | undefined, data: CreateSavedSearchInput) => {
    const effectiveScope =
      (data as { targetScope?: string; scope?: string })?.targetScope ||
      (data as { scope?: string })?.scope ||
      scopeId;
    const { targetScope: _, scope: __, ...payload } = data;
    return libraryClient.post<SavedSearch>(
      resolveLibraryUrl('catalog', '/saved-searches', effectiveScope),
      {
        ...payload,
        ...(isProjectScope(effectiveScope) ? { projectId: effectiveScope } : {}),
      },
    );
  },

  update: (scopeId: string | undefined, id: string, data: UpdateSavedSearchInput) => {
    const effectiveScope =
      (data as { targetScope?: string; scope?: string })?.targetScope ||
      (data as { scope?: string })?.scope ||
      scopeId;
    const { targetScope: _, scope: __, ...payload } = data;
    return libraryClient.patch<SavedSearch>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, effectiveScope),
      payload,
    );
  },

  delete: (scopeId: string | undefined, id: string) =>
    libraryClient.delete<{ success: boolean; id: string }>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, scopeId),
    ),

  preview: (
    scopeId: string | undefined,
    conditions: SavedSearchConditionGroup,
    options?: { sortBy?: string; sortOrder?: 'asc' | 'desc'; scopeOptions?: SavedSearchScopeOptions },
  ): Promise<SavedSearchPreviewResponse> =>
    libraryClient
      .post<SavedSearchPreviewResponse>(
        resolveLibraryUrl('catalog', '/saved-searches/preview', scopeId),
        {
          conditions,
          ...(options?.sortBy ? { sortBy: options.sortBy } : {}),
          ...(options?.sortOrder ? { sortOrder: options.sortOrder } : {}),
          ...(options?.scopeOptions || conditions.scopeOptions ? { scopeOptions: options?.scopeOptions || conditions.scopeOptions } : {}),
          ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
        },
      )
      .then((res) => ({
        ...res,
        sampleItems: Array.isArray(res?.sampleItems)
          ? res.sampleItems.map((it) => mapBackendItem(it))
          : [],
      })),

  getResults: (
    scopeId: string | undefined,
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
        resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}/execute`, scopeId),
        params ? { params } : undefined,
      )
      .then((res) => ({
        ...res,
        items: Array.isArray(res?.items)
          ? res.items.map((it) => mapBackendItem(it))
          : [],
      })),

  execute: (scopeId: string | undefined, id: string, params?: { page?: number; limit?: number }) =>
    SavedSearchesService.getResults(scopeId, id, params),
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
    scopeId?: string,
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
        resolveLibraryUrl('search', '/search', scopeId),
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
    scopeId?: string,
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
          scopeId,
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
};

