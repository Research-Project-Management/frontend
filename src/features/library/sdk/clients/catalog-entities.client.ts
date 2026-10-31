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
} from '@/features/library/domain/types/library.types';
import {
  libraryClient,
  resolveLibraryUrl,
  getBasePath,
  getCatalogUrl,
  getExportsUrl,
  isProjectScope,
  mapBackendItem,
} from './http.client';

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

  getTree: (scopeId?: string) =>
    libraryClient.get<{ tree: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections/tree', scopeId),
    ),

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

  moveItems: (scopeId: string | undefined, collectionId: string, itemIds: string[]) =>
    libraryClient.post<{ message: string; count: number; targetCollectionId: string | null }>(
      resolveLibraryUrl('catalog', `/collections/${encodeURIComponent(collectionId)}/move-items`, scopeId),
      { itemIds },
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

  detachItems: (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) => CollectionsService.bulkDetachItems(scopeId, collectionId, itemIds),

  getItemCollections: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<{ success?: boolean; collections: Collection[] }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/collections`),
    ).then((res) => res?.collections || (Array.isArray(res) ? res : [])),

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

  updateColor: (
    scopeId: string | undefined,
    tagId: string,
    color: string,
  ): Promise<TagWithCount> => TagsService.update(scopeId, tagId, { color }),

  delete: async (scopeId: string | undefined, tagId: string): Promise<void> => {
    await libraryClient.delete<unknown>(getTagsUrl(scopeId, encodeURIComponent(tagId)));
  },

  deleteAutomatic: async (scopeId?: string): Promise<{ count: number }> => {
    const raw = await libraryClient.delete<{ count?: number; data?: { count: number } }>(
      getTagsUrl(scopeId, 'automatic'),
    );
    return raw?.data || (raw && typeof raw.count === 'number' ? { count: raw.count } : { count: 0 });
  },

  assignToItem: async (
    scopeId: string | undefined,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await libraryClient.post<unknown>(
      getTagsUrl(scopeId, `${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`),
      {},
    );
  },

  attachToItem: async (
    scopeId: string | undefined,
    itemId: string,
    tagName: string,
    color?: string,
  ): Promise<TagWithCount> => {
    const tag = await TagsService.create(scopeId, tagName, color);
    if (tag?.id) {
      await TagsService.assignToItem(scopeId, tag.id, itemId);
    }
    return tag;
  },

  /**
   * Harmonized signature: (scopeId, itemId, tagId) matching detachFromItem.
   */
  removeFromItem: async (
    scopeId: string | undefined,
    itemId: string,
    tagId: string,
  ): Promise<void> => {
    await libraryClient.delete<unknown>(
      getTagsUrl(scopeId, `${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`),
    );
  },

  detachFromItem: (scopeId: string | undefined, itemId: string, tagId: string) =>
    TagsService.removeFromItem(scopeId, itemId, tagId),
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

  getByItem: (scopeId: string | undefined, itemId: string) =>
    NotesService.list(scopeId, itemId),

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

  batchStates: async (
    scopeId?: string,
    itemIds?: string[],
  ): Promise<Record<string, ItemStateData>> => {
    const res = await libraryClient.post<
      Record<string, ItemStateData> | { data: Record<string, ItemStateData> }
    >(resolveLibraryUrl('catalog', '/state/batch', scopeId), { itemIds: itemIds ?? [] });
    return unwrapState(res) ?? {};
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
