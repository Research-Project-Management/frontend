import * as api from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import type {
  Item,
  PaginatedItemsResponse,
  CursorPaginationMeta,
  ItemQueryParams,
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
  RelatedItem,
  SchemaItemTypeDefinition,
  ItemFieldDefinition,
} from '@/features/library/types/library.types';
import type { ItemAttachment } from '@/features/library/types/attachments.types';
import { getItemFileUrl, getPaperFileUrl, isProjectScope } from '@/features/library/domain/item-url';
import { mapBackendItemToPaper, mapBackendPaperToItem } from '@/features/library/domain/metadata';
import { AttachmentsService } from '@/features/library/data/extraction/extraction.service';

export { isProjectScope, getItemFileUrl, getPaperFileUrl, mapBackendItemToPaper, mapBackendPaperToItem };
export type {
  TagWithCount,
  ItemStateData,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchConditionGroup,
};

// ── Payload serialization helper ──────────────────────────────────────────────
/**
 * Prepares payload for API dispatch by stripping undefined values, functions,
 * and client-only transient state flags (prefixed with `_`).
 * Security & mass-assignment enforcement are strictly owned by the Backend's
 * NestJS ValidationPipe (`whitelist: true`) and Guards.
 */
export function sanitizeItemPayload(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      value !== undefined &&
      typeof value !== 'function' &&
      !key.startsWith('_')
    ) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export const fetchPdfBlob = async (
  url: string,
  signal?: AbortSignal,
): Promise<Blob> => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid document URL provided.');
  }

  let targetUrl = url.trim();

  const isLocalStatic =
    targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');

  const rawApiBase =
    typeof API_BASE_URL === 'string' &&
    API_BASE_URL !== 'undefined' &&
    API_BASE_URL !== 'null'
      ? API_BASE_URL.trim()
      : '';

  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : rawApiBase;

  let resolvedUrl = targetUrl;
  let isTrustedOrigin = false;
  try {
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      resolvedUrl = targetUrl;
    } else if (isLocalStatic) {
      resolvedUrl = targetUrl;
    } else if (rawApiBase) {
      const cleanBase = rawApiBase.replace(/\/+$/, '');
      const cleanPath = targetUrl.replace(/^\/+/, '');
      resolvedUrl = `${cleanBase}/${cleanPath}`;
    } else {
      resolvedUrl = targetUrl;
    }

    if (baseUrl) {
      const resolvedOrigin = new URL(resolvedUrl, baseUrl).origin;
      const apiOrigin = rawApiBase ? new URL(rawApiBase, baseUrl).origin : new URL(baseUrl).origin;
      isTrustedOrigin =
        resolvedOrigin === new URL(baseUrl).origin ||
        resolvedOrigin === apiOrigin ||
        targetUrl.startsWith('/api/');
    } else {
      isTrustedOrigin = targetUrl.startsWith('/api/');
    }
  } catch {
    isTrustedOrigin = targetUrl.startsWith('/api/');
  }

  const headers: Record<string, string> = {};
  const token = api.getAuthToken();
  if (token && isTrustedOrigin && !isLocalStatic) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, {
    credentials: isTrustedOrigin && !isLocalStatic ? 'include' : 'same-origin',
    headers,
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized: Session expired or invalid authentication.');
    if (response.status === 403) throw new Error('Forbidden: You do not have permission to view this document.');
    if (response.status === 404) throw new Error('Not Found: The requested document could not be found.');
    throw new Error(`Failed to fetch PDF (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/html')) {
    let errorDetail = '';
    try {
      const text = typeof response.text === 'function' ? await response.text() : '';
      if (text.trim().startsWith('{')) {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        errorDetail = (parsed?.message || parsed?.error || text) as string;
      } else {
        errorDetail = text.substring(0, 100);
      }
    } catch { /* ignore */ }
    throw new Error(`Invalid PDF response payload: Server returned ${contentType} instead of application/pdf${errorDetail ? ` (${errorDetail})` : ''}`);
  }

  const blob = await response.blob();
  if (!blob || blob.size < 5) throw new Error('Empty or invalid document payload received from server.');

  const headerSlice = blob.slice(0, 5);
  const headerBuffer = await headerSlice.arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  const signature = String.fromCharCode(...headerBytes);

  if (!signature.startsWith('%PDF-') && !signature.startsWith('%PDF')) {
    if (signature.startsWith('{') || signature.startsWith('<')) {
      const text = await blob.text().catch(() => '');
      throw new Error(`Invalid PDF response (Server returned structured text): ${text.substring(0, 100)}`);
    }
    throw new Error('Invalid document format: missing %PDF- signature in file header.');
  }

  return blob;
};

// ── Scope URL helper ────────────────────────────────────────────────────────
function getCollectionsUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/collections`
    : `/api/v1/library/collections`;
  return suffix ? `${base}/${suffix}` : base;
}

function getSavedSearchesUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/saved-searches`
    : `/api/v1/library/saved-searches`;
  return suffix ? `${base}/${suffix}` : base;
}
function getItemUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
    : `/api/v1/library/items`;
  return suffix ? `${base}/${suffix}` : base;
}

function unwrapItemResponse(res: unknown): Item & { item: Item; paper: Item } {
  const obj = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const rawItem = ((obj.item || obj.paper || obj.data || res) ?? {}) as Item;
  const item = mapBackendItemToPaper(rawItem);
  return { ...item, item, paper: item };
}

// ── 1. ItemsService ───────────────────────────────────────────────────────────
export const ItemsService = {
  importFromUser: (projectId: string, itemIds: string[]) => {
    if (!projectId || projectId === 'user') {
      throw new Error('Valid target projectId is required for user library import');
    }
    return api.apiPost<{ success: boolean; importedCount: number }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/library/items/import`,
      { itemIds },
    );
  },

  importFromPersonal: (projectId: string, itemIds: string[]) => {
    return ItemsService.importFromUser(projectId, itemIds);
  },

  getCounts: (scopeId?: string) => {
    return api.apiGet<{
      total: number;
      unfiled: number;
      starred: number;
      trash: number;
      itemTypes?: Record<string, number>;
      byItemType?: Record<string, number>;
      role?: import('@/features/library/types/core.types').ProjectRole;
      yourRole?: import('@/features/library/types/core.types').ProjectRole;
      permissions?: Partial<import('@/features/library/types/core.types').LibraryPermissions> | string[];
      effectivePermissions?: string[];
      permissionOverrides?: Record<string, boolean>;
    }>(
      getItemUrl(scopeId, 'counts'),
    );
  },

  getAll: (
    scopeId?: string,
    params?: (ItemQueryParams & { cursor?: string; fields?: readonly string[] | string[] | string }) | {
      view?: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications' | string;
      search?: string;
      collectionId?: string;
      tagId?: string;
      limit?: number;
      cursor?: string;
      fields?: readonly string[] | string[] | string;
      [key: string]: unknown;
    },
    options?: { signal?: AbortSignal },
  ) => {
    const rawParams = params as Record<string, unknown> | undefined;
    const rawTag = rawParams?.tag;
    const rawCollectionIds = rawParams?.collectionIds;
    const formattedParams: Record<string, string | number | boolean | null | undefined> | undefined = params
      ? {
          ...(params as Record<string, string | number | boolean | null | undefined>),
          collectionIds: Array.isArray(rawCollectionIds)
            ? rawCollectionIds.join(',')
            : (rawCollectionIds as string | undefined),
          fields: Array.isArray(params.fields)
            ? params.fields.join(',')
            : (params.fields as string | undefined),
          tag: Array.isArray(rawTag)
            ? rawTag.join(',')
            : (rawTag as string | undefined) ||
              (Array.isArray(params.tags) ? params.tags.join(',') : (params.tags as string | undefined)),
          tags: Array.isArray(params.tags)
            ? params.tags.join(',')
            : (params.tags as string | undefined),
        }
      : undefined;
    return api.apiGet<PaginatedItemsResponse>(
      getItemUrl(scopeId),
      {
        params: formattedParams,
        signal: options?.signal,
      },
    ).then((res) => {
      const rawItems: Item[] = Array.isArray(res)
        ? res
        : res?.items || [];
      const items = rawItems.map((it) => mapBackendItemToPaper(it));
      const meta = (res?.pagination || res?.meta) as CursorPaginationMeta | undefined;
      const total =
        meta?.totalCount ??
        res?.total ??
        items.length;
      return {
        items,
        papers: items,
        total,
        meta,
        pagination: meta,
      };
    });
  },

  getById: (scopeId: string, itemId: string) =>
    api.apiGet<Item | { item?: Item; paper?: Item }>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
    ).then(unwrapItemResponse),

  getMetadataSources: (scopeId: string | undefined, itemId: string) =>
    api.apiGet<ItemMetadataSourcesResponse>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/metadata-sources`),
    ),

  getByCollection: (scopeId: string, collectionId: string, search?: string) =>
    api.apiGet<Record<string, unknown> | Item[]>(
      getItemUrl(scopeId),
      { params: { collectionId, ...(search ? { search } : {}) } },
    ).then((res) => {
      const rawPapers: Item[] = Array.isArray(res)
        ? res
        : (((res as Record<string, unknown>)?.items || (res as Record<string, unknown>)?.papers || (res as Record<string, unknown>)?.data || []) as Item[]);
      const papers = rawPapers.map((it) => mapBackendItemToPaper(it));
      return {
        collection: res && !Array.isArray(res) ? (res as Record<string, unknown>).collection : undefined,
        items: papers,
        papers,
        data: papers,
      };
    }),

  create: (scopeId: string, collectionId: string, data: Partial<Item>): Promise<Item & { item: Item; paper: Item }> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (collectionId) {
      payload.collectionId = collectionId;
    }
    return api.apiPost<Record<string, unknown>>(
      getItemUrl(scopeId),
      payload,
    ).then(unwrapItemResponse);
  },

  update: async (
    scopeId: string,
    itemId: string,
    data: Partial<Item>,
    expectedVersion?: number,
  ): Promise<Item & { item: Item; paper: Item }> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    const resolvedVersion =
      expectedVersion ??
      (data as { expectedVersion?: number })?.expectedVersion ??
      data.version;
    if (resolvedVersion !== undefined && typeof resolvedVersion === 'number') {
      payload.expectedVersion = resolvedVersion;
    }
    const res = await api.apiPatch<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    return unwrapItemResponse(res);
  },

  patch: (
    scopeId: string,
    itemId: string,
    data: Partial<Item>,
    expectedVersion?: number,
  ): Promise<Item & { item: Item; paper: Item }> =>
    ItemsService.update(scopeId, itemId, data, expectedVersion),

  replace: async (
    scopeId: string,
    itemId: string,
    data: Partial<Item>,
    expectedVersion?: number,
  ): Promise<Item & { item: Item; paper: Item }> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (expectedVersion !== undefined) {
      payload.expectedVersion = expectedVersion;
    }
    const res = await api.apiPut<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    return unwrapItemResponse(res);
  },

  delete: (scopeId: string, itemId: string) =>
    api.apiDelete(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
    ),

  restore: (scopeId: string, itemId: string, expectedVersion?: number) => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    return api.apiPost<Record<string, unknown>>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/restore${versionQuery}`),
      {},
    ).then((res) => {
      const { item } = unwrapItemResponse(res);
      return { success: true, data: item, item, paper: item };
    });
  },

  purge: (scopeId: string, itemId: string) =>
    api.apiDelete<{ success: boolean; data: { purged: boolean } }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/purge`),
    ),

  bulkPurge: (scopeId: string, itemIds: string[]) =>
    api.apiPost<{ success: boolean; count: number; purgedIds: string[] }>(
      getItemUrl(scopeId, 'bulk-purge'),
      { itemIds },
    ),

  bulkTrash: (scopeId: string, itemIds: string[]) =>
    api.apiPost<{ success: boolean; count: number; trashedIds: string[] }>(
      getItemUrl(scopeId, 'bulk-trash'),
      { itemIds },
    ),

  bulkRestore: (scopeId: string, itemIds: string[]) =>
    api.apiPost<{ success: boolean; count: number; restoredIds: string[] }>(
      getItemUrl(scopeId, 'bulk-restore'),
      { itemIds },
    ),

  addAttachment: (
    scopeId: string,
    itemId: string,
    data: Partial<ItemAttachment>,
  ) => AttachmentsService.createAttachment(scopeId, itemId, data),

  deleteAttachment: (
    scopeId: string,
    itemId: string,
    attachmentId: string,
  ) => AttachmentsService.deleteAttachment(scopeId, attachmentId),

  importFromStorage: (
    scopeId: string,
    data: {
      fileId: string;
      filename?: string;
      collectionId?: string | null;
      title?: string;
      authors?: string[];
      year?: string | number;
      doi?: string;
      abstract?: string;
    },
  ) => {
    const isProject = isProjectScope(scopeId);
    const url = isProject
      ? `/api/v1/library/ingestion/submit?projectId=${encodeURIComponent(scopeId)}`
      : `/api/v1/library/ingestion/submit`;
    return api.apiPost<{ item: Item }>(url, {
      kind: 'FILE',
      fileId: data.fileId,
      filename: data.filename,
      collectionIds: data.collectionId ? [data.collectionId] : undefined,
      projectId: isProject ? scopeId : undefined,
      overrides: {
        title: data.title,
        authors: data.authors,
        year: data.year,
        doi: data.doi,
        abstract: data.abstract,
      },
    });
  },

  reindex: (scopeId: string, itemId: string) =>
    api.apiPost<{ message: string; itemId: string }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
    ),

  getItemTypes: (_scopeId?: string) =>
    api.apiGet<Record<string, unknown>>(
      `/api/v1/library/item-types`,
      { rawEnvelope: true },
    ),

  getItemType: (_scopeId: string, itemType: string) =>
    api.apiGet<{ success: boolean; itemType: unknown; data: unknown }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
    ),

  previewConvertType: (
    scopeId: string,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra: boolean = true,
  ) =>
    api.apiPost<{ success: boolean; preview: unknown; data: unknown }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type/preview`),
      { targetType, retainUnmappedInExtra },
    ),

  previewTypeConversion: (
    scopeId: string,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra: boolean = true,
  ) =>
    ItemsService.previewConvertType(
      scopeId,
      itemId,
      targetType,
      retainUnmappedInExtra,
    ),

  convertType: (
    scopeId: string,
    itemId: string,
    targetType: string,
    expectedVersion?: number,
    retainUnmappedInExtra: boolean = true,
  ) =>
    api.apiPost<{ success: boolean; paper: Item; item: Item; conversionReport: unknown }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type`),
      { targetType, expectedVersion, retainUnmappedInExtra },
    ),

  reindexItem: (scopeId: string | undefined, itemId: string) =>
    api.apiPost<{ success: boolean; data?: unknown }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
      {},
    ).then((res) => res?.data || res || { success: true }),

  getFulltext: (scopeId: string | undefined, itemId: string) =>
    api.apiGet<Record<string, unknown>>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/fulltext`),
    ).then((res) => (res as { data?: unknown })?.data || res || null).catch(() => null),

  getItemFileUrl,
  getPaperFileUrl,

  getItem: (scopeId: string | undefined, itemId: string) =>
    ItemsService.getById(scopeId || 'user', itemId),

  updateItem: (scopeId: string | undefined, itemId: string, data: Partial<Item>) =>
    ItemsService.update(scopeId || 'user', itemId, data),

  fetchPdfBlob: (url: string, signal?: AbortSignal) =>
    fetchPdfBlob(url, signal),

  markMyPublication: (scopeId: string, itemId: string) =>
    ItemsService.setMyPublication(scopeId, itemId, true),

  unmarkMyPublication: (scopeId: string, itemId: string) =>
    ItemsService.setMyPublication(scopeId, itemId, false),

  reResolveMetadata: (
    scopeId: string | undefined,
    itemId: string,
    body?: Record<string, unknown>,
  ) =>
    api.apiPost<{ success: boolean; data?: unknown; item?: Item }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/re-resolve`),
      body || {},
    ),

  parseCitations: (scopeId: string | undefined, rawCitations: string) =>
    api.apiPost<{
      success: boolean;
      count: number;
      references: Record<string, unknown>[];
      citations: Record<string, unknown>[];
    }>(
      getItemUrl(scopeId, 'citations/parse'),
      { rawCitations, citations: rawCitations },
    ),

  getRelated: (scopeId: string | undefined, itemId: string) =>
    RelationsService.getRelated(scopeId, itemId),

  linkRelated: (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string | string[],
    relationType?: string,
  ) => RelationsService.link(scopeId, itemId, targetItemId, relationType),

  unlinkRelated: (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string,
  ) => RelationsService.unlink(scopeId, itemId, targetItemId),

  setMyPublication: (scopeId: string, itemId: string, isMyPublication: boolean) =>
    isMyPublication
      ? api.apiPost<{ success: boolean; data: Item; item: Item }>(
          getItemUrl(scopeId, `${encodeURIComponent(itemId)}/my-publication`),
          {},
        ).then((res) => res?.item || res?.data || res)
      : api.apiDelete<{ success: boolean; data: Item; item: Item }>(
          getItemUrl(scopeId, `${encodeURIComponent(itemId)}/my-publication`),
        ).then((res) => res?.item || res?.data || res),
};

export interface ItemMetadataSourceItem {
  id: string;
  sourceProvider: string;
  sourceUri?: string | null;
  format?: string | null;
  fetchedAt: string;
  createdAt: string;
  rawPayload?: unknown;
}

export interface ItemMetadataSourcesResponse {
  itemId: string;
  count: number;
  sources: ItemMetadataSourceItem[];
}

export const ItemService = ItemsService;

// ── 2. CollectionsService ─────────────────────────────────────────────────────

export const CollectionsService = {
  getAll: (scopeId?: string) =>
    api.apiGet<{ collections: Collection[] }>(
      getCollectionsUrl(scopeId),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  /**
   * Get hierarchical collection tree (for sidebar/tree view rendering)
   * Backed by GET /collections/tree
   */
  getTree: (scopeId?: string) =>
    api.apiGet<{ tree: Collection[] }>(
      getCollectionsUrl(scopeId, 'tree'),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  getById: (scopeId?: string, collectionId?: string) => {
    const effectiveScope = collectionId ? scopeId : undefined;
    const effectiveId = collectionId || scopeId || '';
    return api.apiGet<{ collection: Collection }>(
      getCollectionsUrl(effectiveScope, encodeURIComponent(effectiveId)),
      { params: isProjectScope(effectiveScope) ? { projectId: effectiveScope } : undefined },
    );
  },

  create: (scopeId: string | undefined, data: CreateCollectionDTO) =>
    api.apiPost<{ collection: Collection }>(
      getCollectionsUrl(scopeId),
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  update: (scopeId: string | undefined, collectionId: string, data: UpdateCollectionDTO) =>
    api.apiPut<{ collection: Collection }>(
      getCollectionsUrl(scopeId, encodeURIComponent(collectionId)),
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  delete: (scopeId: string | undefined, collectionId: string, strategy?: "cascade" | "move-to-parent" | "orphan") =>
    api.apiDelete(
      getCollectionsUrl(scopeId, encodeURIComponent(collectionId)),
      {
        params: {
          ...(strategy ? { strategy } : {}),
          ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
        },
      },
    ),

  moveItems: (scopeId: string | undefined, collectionId: string, itemIds: string[]) =>
    api.apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      getCollectionsUrl(scopeId, `${encodeURIComponent(collectionId)}/move-items`),
      { itemIds, paperIds: itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  movePapers: (scopeId: string | undefined, collectionId: string, paperIds: string[]) =>
    CollectionsService.moveItems(scopeId, collectionId, paperIds),

  reorder: (
    scopeId: string | undefined,
    collections: Array<{ id: string; parentId?: string | null; orderIndex?: number }>,
  ) =>
    api.apiPatch<{ collections: Collection[] }>(
      getCollectionsUrl(scopeId, 'reorder'),
      { collections },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  /**
   * Assign items to a collection (batch, non-destructive add)
   * Backed by POST /collections/:collectionId/items
   */
  assignItems: (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    api.apiPost<{ count: number; collectionId: string }>(
      getCollectionsUrl(scopeId, `${encodeURIComponent(collectionId)}/items`),
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  /**
   * Remove a single item from a collection without deleting the item
   * Backed by DELETE /collections/:collectionId/items/:itemId
   */
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
    api.apiDelete<{ detached: boolean }>(
      getCollectionsUrl(scopeId, `${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  /**
   * Remove multiple items from a collection in a single batch request
   * Backed by POST /collections/:collectionId/items/bulk-detach
   */
  bulkDetachItems: (
    scopeId: string | undefined,
    collectionId: string,
    itemIds: string[],
  ) =>
    api.apiPost<{ success: boolean; count: number }>(
      getCollectionsUrl(scopeId, `${encodeURIComponent(collectionId)}/items/bulk-detach`),
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getItemCollections: (scopeId: string | undefined, itemId: string) =>
    api.apiGet<{ success?: boolean; collections: Collection[] }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/collections`),
    ).then((res) => res?.collections || (Array.isArray(res) ? res : [])),
  exportBibtex: (scopeId: string | undefined, collectionId: string) => {
    const projectQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return api.apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId)}${projectQuery}`,
    );
  },

  exportBundle: (_scopeId: string | undefined, collectionId: string) =>
    api.apiGet<{
      collection: { id: string; name: string };
      totalPapers: number;
      totalFiles: number;
      bibtex: string;
      files: Array<{ paperId: string; title: string; filename: string; fileUrl: string }>;
    }>(
      `/api/v1/library/exports/${encodeURIComponent(collectionId)}/export-bundle`,
    ),
};

export const getCollections = CollectionsService.getAll;
export const createCollection = CollectionsService.create;
export const updateCollection = CollectionsService.update;
export const deleteCollection = CollectionsService.delete;
export const CollectionService = CollectionsService;

// ── 3. TagsService ────────────────────────────────────────────────────────────

export const TagsService = {
  list: async (scopeId?: string): Promise<TagWithCount[]> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await api.apiGet<TagWithCount[] | { data: TagWithCount[] }>(basePath);
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      return raw.data;
    }
    return [];
  },

  create: async (
    scopeId: string | undefined,
    name: string,
    color?: string,
    type: string = 'manual',
  ): Promise<TagWithCount> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await api.apiPost<TagWithCount | { data: TagWithCount }>(
      basePath,
      {
        name,
        color,
        type,
        ...(isProject ? { projectId: scopeId } : {}),
      },
    );
    return (raw && 'data' in raw && raw.data ? raw.data : raw) as TagWithCount;
  },

  update: async (
    scopeId: string | undefined,
    tagId: string,
    data: { name?: string; color?: string; type?: string },
  ): Promise<TagWithCount> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await api.apiPatch<TagWithCount | { data: TagWithCount }>(
      `${basePath}/${encodeURIComponent(tagId)}`,
      data,
    );
    return (raw && 'data' in raw && raw.data ? raw.data : raw) as TagWithCount;
  },

  updateColor: async (
    scopeId: string | undefined,
    tagId: string,
    color: string,
  ): Promise<TagWithCount> => {
    return TagsService.update(scopeId, tagId, { color });
  },

  delete: async (scopeId: string | undefined, tagId: string): Promise<void> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    await api.apiDelete<unknown>(
      `${basePath}/${encodeURIComponent(tagId)}`,
    );
  },

  deleteAutomatic: async (
    scopeId?: string,
  ): Promise<{ count: number }> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await api.apiDelete<{ count?: number; data?: { count: number } }>(
      `${basePath}/automatic`,
    );
    return raw?.data || (raw && typeof raw.count === 'number' ? { count: raw.count } : { count: 0 });

  },
  assignToItem: async (
    scopeId: string | undefined,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    await api.apiPost<unknown>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
      {},
    );
  },

  removeFromItem: async (
    scopeId: string | undefined,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    await api.apiDelete<unknown>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
    );
  },
};

// ── 4. NotesService ───────────────────────────────────────────────────────────

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

function getNotesBasePath(scopeId?: string): string {
  return isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/notes`
    : `/api/v1/library/notes`;
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
  /**
   * List notes, optionally filtered by itemId
   */
  list: async (scopeId?: string, itemId?: string): Promise<Note[]> => {
    const isProject = isProjectScope(scopeId);
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', itemId);
    if (isProject) params.set('projectId', scopeId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const basePath = getNotesBasePath(scopeId);
    const raw = await api.apiGet<Note[] | { success?: boolean; data?: Note[]; notes?: Note[] }>(`${basePath}${queryString}`);

    if (Array.isArray(raw)) {
      return raw;
    }
    return (raw && typeof raw === 'object' ? (raw.data || raw.notes) : []) || [];
  },

  /**
   * Get single note by id
   */
  get: async (scopeId: string | undefined, id: string): Promise<Note> => {
    const basePath = getNotesBasePath(scopeId);
    const raw = await api.apiGet<Note | { success?: boolean; data?: Note; note?: Note }>(
      `${basePath}/${encodeURIComponent(id)}`,
    );
    return unwrapNoteResponse(raw);
  },

  /**
   * Create a new canonical Note
   */
  create: async (scopeId: string | undefined, dto: CreateNoteDTO): Promise<Note> => {
    const isProject = isProjectScope(scopeId);
    const basePath = getNotesBasePath(scopeId);
    const raw = await api.apiPost<Note | { success?: boolean; data?: Note; note?: Note }>(
      basePath,
      {
        ...dto,
        ...(isProject ? { projectId: scopeId } : {}),
      },
    );
    return unwrapNoteResponse(raw);
  },

  /**
   * Update an existing Note with optimistic locking
   */
  update: async (
    scopeId: string | undefined,
    id: string,
    expectedVersion: number | undefined,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const basePath = getNotesBasePath(scopeId);
    const raw = await api.apiPatch<Note | { success?: boolean; data?: Note; note?: Note }>(
      `${basePath}/${encodeURIComponent(id)}`,
      {
        ...dto,
        expectedVersion,
      },
    );
    return unwrapNoteResponse(raw);
  },

  /**
   * Soft-delete a Note
   */
  delete: async (
    scopeId: string | undefined,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const basePath = getNotesBasePath(scopeId);
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await api.apiDelete<{ deleted?: boolean; data?: { deleted: boolean } }>(
      `${basePath}/${encodeURIComponent(id)}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },

  /**
   * Extract and compile notes from PDF annotations for an item
   * Backed by POST /api/v1/library/notes/items/:itemId/from-annotations
   */
  extractFromAnnotations: async (
    scopeId: string | undefined,
    itemId: string,
    options?: { noteId?: string; tagColor?: boolean; includeComments?: boolean },
  ): Promise<Note> => {
    const basePath = getNotesBasePath(scopeId);
    const raw = await api.apiPost<Note | { success?: boolean; data?: Note; note?: Note }>(
      `${basePath}/items/${encodeURIComponent(itemId)}/from-annotations`,
      options || {},
    );
    return unwrapNoteResponse(raw);
  },

  extractNotes: async (
    scopeId: string | undefined,
    itemId: string,
    options?: { noteId?: string; tagColor?: boolean; includeComments?: boolean },
  ): Promise<Note> => {
    return NotesService.extractFromAnnotations(scopeId, itemId, options);
  },
};

export const getNote = NotesService.get;
export const createNote = NotesService.create;
export const updateNote = NotesService.update;
export const deleteNote = NotesService.delete;

// ── 5. StateService ───────────────────────────────────────────────────────────

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
    const basePath = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/state`
      : `/api/v1/library/items/${encodeURIComponent(itemId)}/state`;
    const res = await api.apiGet<ItemStateData | { data: ItemStateData }>(basePath);
    return unwrapState(res);
  },

  updateState: async (
    scopeId?: string,
    itemId?: string,
    data?: {
      isStarred?: boolean;
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
      currentPage?: number;
      scrollPosition?: Record<string, unknown> | Array<unknown> | null;
    },
  ): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/state`
      : `/api/v1/library/items/${encodeURIComponent(itemId)}/state`;
    const res = await api.apiPatch<ItemStateData | { data: ItemStateData }>(
      basePath,
      data ?? {},
    );
    return unwrapState(res) ?? ({} as ItemStateData);
  },

  markAsRead: async (scopeId?: string, itemId?: string): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const basePath = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/state/read`
      : `/api/v1/library/items/${encodeURIComponent(itemId)}/state/read`;
    const res = await api.apiPost<ItemStateData | { data: ItemStateData }>(
      basePath,
      {},
    );
    return unwrapState(res) ?? ({} as ItemStateData);
  },

  batchStates: async (
    scopeId?: string,
    itemIds?: string[],
  ): Promise<Record<string, ItemStateData>> => {
    const basePath = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/state/batch`
      : `/api/v1/library/items/state/batch`;
    const res = await api.apiPost<
      Record<string, ItemStateData> | { data: Record<string, ItemStateData> }
    >(basePath, { itemIds: itemIds ?? [] });
    return unwrapState(res) ?? {};
  },
};

// ── 6. ItemTypesService ───────────────────────────────────────────────────────

export interface ItemTypesResponse {
  success: boolean;
  registryVersion: number;
  schemaVersion: number;
  source: string;
  itemTypes: SchemaItemTypeDefinition[];
  data: SchemaItemTypeDefinition[];
  baseFieldMappings?: Record<string, Record<string, string>>;
  reverseBaseFieldMappings?: Record<string, Record<string, string>>;
  creatorRoles?: Record<string, string>;
  cslTypeMap?: Record<string, string>;
  cslFieldMap?: Record<string, string>;
}

export interface ItemTypeDetailResponse {
  success: boolean;
  itemType: SchemaItemTypeDefinition;
  data: SchemaItemTypeDefinition;
}

export interface ItemTypeFieldsResponse {
  success: boolean;
  itemType: string;
  fields: ItemFieldDefinition[];
  count: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  itemType: string;
  errors: string[];
  warnings: string[];
  harmonizedCreators?: Array<{
    originalRole: string;
    normalizedRole: string;
    creatorName: string;
    reason: string;
  }>;
  demotedFields?: Record<string, unknown>;
  sanitizedPayload?: Record<string, unknown>;
}

export const ItemTypesService = {
  getAllItemTypes: () => {
    return api.apiGet<ItemTypesResponse>('/api/v1/library/item-types');
  },

  getSchemaSnapshot: () => {
    return api.apiGet<Record<string, unknown>>('/api/v1/library/item-types/schema');
  },

  getItemType: (itemType: string) => {
    return api.apiGet<ItemTypeDetailResponse>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
    );
  },

  getItemTypeFields: (itemType: string) => {
    return api.apiGet<ItemTypeFieldsResponse>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}/fields`,
    );
  },

  getItemTypeCreatorTypes: (itemType: string) => {
    return api.apiGet<{
      success: boolean;
      itemType: string;
      primaryCreatorType: string;
      creatorTypes: string[];
    }>(`/api/v1/library/item-types/${encodeURIComponent(itemType)}/creator-types`);
  },

  getItemTypeCslMapping: (itemType: string) => {
    return api.apiGet<{
      success: boolean;
      itemType: string;
      cslType: string;
    }>(`/api/v1/library/item-types/${encodeURIComponent(itemType)}/csl`);
  },

  validateItem: (itemType: string, payload: Record<string, unknown>) => {
    return api.apiPost<{ success: boolean; result: SchemaValidationResult }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}/validate`,
      payload,
    );
  },
};

// ── 7. SavedSearchesService ───────────────────────────────────────────────────

export const SavedSearchesService = {
  getAll: (scopeId?: string) =>
    api.apiGet<SavedSearch[]>(
      getSavedSearchesUrl(scopeId),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getById: (scopeId: string | undefined, id: string) =>
    api.apiGet<SavedSearch>(
      getSavedSearchesUrl(scopeId, encodeURIComponent(id)),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  create: (scopeId: string | undefined, data: CreateSavedSearchInput) =>
    api.apiPost<SavedSearch>(
      getSavedSearchesUrl(scopeId),
      {
        ...data,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  update: (scopeId: string | undefined, id: string, data: UpdateSavedSearchInput) =>
    api.apiPatch<SavedSearch>(
      getSavedSearchesUrl(scopeId, encodeURIComponent(id)),
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  delete: (scopeId: string | undefined, id: string) =>
    api.apiDelete<{ success: boolean; id: string }>(
      getSavedSearchesUrl(scopeId, encodeURIComponent(id)),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  preview: (scopeId: string | undefined, conditions: SavedSearchConditionGroup) =>
    api.apiPost<SavedSearchPreviewResponse>(
      getSavedSearchesUrl(scopeId, 'preview'),
      {
        conditions,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getResults: (
    scopeId: string | undefined,
    id: string,
    params?: {
      limit?: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) =>
    api.apiGet<SavedSearchResultsResponse>(
      getSavedSearchesUrl(scopeId, `${encodeURIComponent(id)}/results`),
      {
        params: {
          ...params,
          ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
        },
      },
    ),
};

// ── 8. RelationsService ───────────────────────────────────────────────────────

export const RelationsService = {
  getRelated: (scopeId: string | undefined, itemId: string) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    return api.apiGet<{ relatedItems?: RelatedItem[]; relatedPapers?: RelatedItem[]; total?: number }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
    ).then((res) => {
      const items = res?.relatedItems ?? res?.relatedPapers ?? [];
      return {
        relatedItems: items,
        total: res?.total ?? items.length,
      };
    });
  },

  link: (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string | string[],
    relationType: string = 'related',
  ) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    const payload = Array.isArray(targetItemId)
      ? { targetItemIds: targetItemId, relationType }
      : { targetItemId, relationType };
    return api.apiPost<{ message: string; relationType?: string; totalLinked?: number }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
      payload,
    );
  },

  unlink: (scopeId: string | undefined, itemId: string, targetItemId: string, _relationType?: string) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    return api.apiDelete<{ message: string }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`,
    );
  },
};

export const RelationService = RelationsService;

// ── Unified Catalog Domain Service ────────────────────────────────────────────

export const CatalogService = {
  items: ItemsService,
  collections: CollectionsService,
  tags: TagsService,
  notes: NotesService,
  state: StateService,
  types: ItemTypesService,
  savedSearches: SavedSearchesService,
  relations: RelationsService,
};
