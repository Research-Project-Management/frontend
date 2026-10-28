import {
  type Item,
  type PaginatedItemsResponse,
  type CursorPaginationMeta,
  type ItemQueryParams,
  type RelatedItem,
  type SchemaItemTypeDefinition,
  normalizeRelationType,
} from '@/features/library/domain/types/library.types';
import type { DocumentFulltext } from '@/features/library/domain/types/reader.types';
import {
  libraryClient,
  resolveLibraryUrl,
  resolveLibraryRawPath,
  getCatalogUrl,
  sanitizeItemPayload,
  unwrapItemResponse,
  fetchPdfBlob,
  getItemFileUrl,
  mapBackendItem,
} from './http.client';

// 7. RelationsService
export const RelationsService = {
  getRelated: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<{ relatedItems?: RelatedItem[]; total?: number }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/relations`),
    ).then((res) => {
      const items = (res?.relatedItems ?? []).map((rel) => ({
        ...rel,
        relationType: normalizeRelationType(rel?.relationType),
      }));
      return {
        relatedItems: items,
        total: res?.total ?? items.length,
      };
    }),

  list: (scopeId: string | undefined, itemId: string) =>
    RelationsService.getRelated(scopeId, itemId).then((r) => r.relatedItems),

  link: (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string | string[],
    relationType: string = 'related',
  ) => {
    const normalizedRelationType = normalizeRelationType(relationType);
    const payload = Array.isArray(targetItemId)
      ? { targetItemIds: targetItemId, relationType: normalizedRelationType }
      : { targetItemId, relationType: normalizedRelationType };
    return libraryClient.post<{ message: string; relationType?: string; totalLinked?: number }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/relations`),
      payload,
    );
  },

  unlink: (scopeId: string | undefined, itemId: string, targetItemId: string, _relationType?: string) =>
    libraryClient.delete<{ message: string }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`),
    ),
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

export interface LibraryBootstrapResponse {
  scope: 'user' | 'project';
  scopeId: string;
  counts?: {
    total: number;
    unfiled: number;
    starred: number;
    trash: number;
    itemTypes?: Record<string, number>;
    byItemType?: Record<string, number>;
    role?: import('@/features/library/domain/types/core.types').ProjectRole;
    yourRole?: import('@/features/library/domain/types/core.types').ProjectRole;
    permissions?: Partial<import('@/features/library/domain/types/core.types').LibraryPermissions> | string[];
    effectivePermissions?: string[];
    permissionOverrides?: Record<string, boolean>;
  };
  collections?: import('@/features/library/domain/types/library.types').Collection[];
  savedSearches?: import('@/features/library/domain/types/library.types').SavedSearch[];
  syncVersion?: {
    version: string;
    scope: 'user' | 'project';
    scopeId: string;
  };
  itemTypes?: Record<string, unknown>;
  feedSubscriptions?: import('./ingestion-sync.client').FeedSubscriptionResponse[];
  items?: Item[];
  meta?: CursorPaginationMeta;
  pagination?: CursorPaginationMeta;
}

// 1. ItemsService
export const ItemsService = {
  getBootstrap: (
    scopeId?: string,
    params?: ItemQueryParams & { includeItems?: boolean },
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
              (Array.isArray(rawParams?.tags) ? (rawParams.tags as string[]).join(',') : (rawParams?.tags as string | undefined)),
        }
      : undefined;
    return libraryClient
      .get<LibraryBootstrapResponse>(
        resolveLibraryUrl('catalog', '/bootstrap', scopeId),
        {
          params: formattedParams,
          signal: options?.signal,
        },
        scopeId,
      )
      .then((res) => {
        if (!res || typeof res !== 'object') return res;
        const rawItems: Item[] = Array.isArray(res.items) ? res.items : [];
        return {
          ...res,
          items: Array.isArray(res.items) ? rawItems.map((it) => mapBackendItem(it)) : undefined,
        };
      });
  },

  importFromUser: (projectId: string, itemIds: string[]) => {
    if (!projectId || projectId === 'user') {
      throw new Error('Valid target projectId is required for user library import');
    }
    return libraryClient.post<{ success: boolean; importedCount: number }>(
      resolveLibraryUrl('catalog', '/items/import', projectId),
      { itemIds },
    );
  },

  getCounts: (scopeId?: string) =>
    libraryClient.get<{
      total: number;
      unfiled: number;
      starred: number;
      trash: number;
      itemTypes?: Record<string, number>;
      byItemType?: Record<string, number>;
      role?: import('@/features/library/domain/types/core.types').ProjectRole;
      yourRole?: import('@/features/library/domain/types/core.types').ProjectRole;
      permissions?: Partial<import('@/features/library/domain/types/core.types').LibraryPermissions> | string[];
      effectivePermissions?: string[];
      permissionOverrides?: Record<string, boolean>;
    }>(getCatalogUrl(scopeId, 'counts')),

  getPermissions: (scopeId?: string) =>
    libraryClient.get<{
      scope: 'user' | 'project';
      projectId: string | null;
      role: import('@/features/library/domain/types/core.types').ProjectRole;
      yourRole: import('@/features/library/domain/types/core.types').ProjectRole;
      permissions: import('@/features/library/domain/types/core.types').LibraryPermissions;
      effectivePermissions: string[];
      permissionOverrides: Record<string, boolean>;
    }>(resolveLibraryUrl('catalog', '/permissions', scopeId)),

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
              (Array.isArray(rawParams?.tags) ? (rawParams.tags as string[]).join(',') : (rawParams?.tags as string | undefined)),
        }
      : undefined;
    return libraryClient.get<PaginatedItemsResponse & { pagination?: CursorPaginationMeta }>(
      getCatalogUrl(scopeId),
      {
        params: formattedParams,
        signal: options?.signal,
      },
    ).then((res) => {
      const rawItems: Item[] = Array.isArray(res)
        ? res
        : res?.items || [];
      const items = rawItems.map((it) => mapBackendItem(it));
      const meta = (res?.meta || res?.pagination) as CursorPaginationMeta | undefined;
      const total =
        meta?.totalCount ??
        res?.total ??
        items.length;
      return {
        items,
        total,
        meta,
        pagination: meta,
      };
    });
  },

  list: (
    scopeId?: string,
    params?: ItemQueryParams,
    options?: { signal?: AbortSignal },
  ) => ItemsService.getAll(scopeId, params, options),

  getById: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<Item | { item?: Item }>(
      getCatalogUrl(scopeId || 'user', encodeURIComponent(itemId)),
    ).then(unwrapItemResponse),

  getMetadataSources: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<ItemMetadataSourcesResponse>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/metadata-sources`),
    ),

  getByCollection: (scopeId: string | undefined, collectionId: string, search?: string) =>
    libraryClient.get<Record<string, unknown> | Item[]>(
      getCatalogUrl(scopeId || 'user'),
      { params: { collectionId, ...(search ? { search } : {}) } },
    ).then((res) => {
      const rawItems: Item[] = Array.isArray(res)
        ? res
        : (((res as Record<string, unknown>)?.items || (res as Record<string, unknown>)?.data || []) as Item[]);
      const items = rawItems.map((it) => mapBackendItem(it));
      return {
        collection: res && !Array.isArray(res) ? (res as Record<string, unknown>).collection : undefined,
        items,
      };
    }),

  create: (
    scopeId: string | undefined,
    collectionId: string,
    data: Partial<Item> | Record<string, unknown>,
  ): Promise<Item> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (collectionId) {
      payload.collectionId = collectionId;
    }
    return libraryClient.post<Record<string, unknown>>(
      getCatalogUrl(scopeId || 'user'),
      payload,
    ).then(unwrapItemResponse);
  },

  update: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<Item> | Record<string, unknown>,
    expectedVersion?: number,
  ): Promise<Item> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    const resolvedVersion =
      expectedVersion ??
      (data as { expectedVersion?: number })?.expectedVersion ??
      (data as Partial<Item>)?.version;
    if (resolvedVersion !== undefined && typeof resolvedVersion === 'number') {
      payload.expectedVersion = resolvedVersion;
    }
    const res = await libraryClient.patch<Record<string, unknown>>(
      getCatalogUrl(scopeId || 'user', encodeURIComponent(itemId)),
      payload,
    );
    return unwrapItemResponse(res);
  },

  patch: (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<Item> | Record<string, unknown>,
    expectedVersion?: number,
  ): Promise<Item> =>
    ItemsService.update(scopeId, itemId, data, expectedVersion),

  replace: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<Item> | Record<string, unknown>,
    expectedVersion?: number,
  ): Promise<Item> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (expectedVersion !== undefined) {
      payload.expectedVersion = expectedVersion;
    }
    const res = await libraryClient.put<Record<string, unknown>>(
      getCatalogUrl(scopeId || 'user', encodeURIComponent(itemId)),
      payload,
    );
    return unwrapItemResponse(res);
  },

  delete: (scopeId: string | undefined, itemId: string) =>
    libraryClient.delete(
      getCatalogUrl(scopeId || 'user', encodeURIComponent(itemId)),
    ),

  restore: (scopeId: string | undefined, itemId: string, expectedVersion?: number) => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    return libraryClient.post<Record<string, unknown>>(
      getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/restore${versionQuery}`),
      {},
    ).then((res) => {
      const item = unwrapItemResponse(res);
      return { success: true, item };
    });
  },

  purge: (scopeId: string | undefined, itemId: string) =>
    libraryClient.delete<{ success: boolean; data: { purged: boolean } }>(
      getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/purge`),
    ),

  bulkPurge: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient.post<{ success: boolean; count: number; purgedIds: string[] }>(
      getCatalogUrl(scopeId || 'user', 'bulk-purge'),
      { itemIds },
    ),

  bulkTrash: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient.post<{ success: boolean; count: number; trashedIds: string[] }>(
      getCatalogUrl(scopeId || 'user', 'bulk-trash'),
      { itemIds },
    ),

  bulkDelete: (scopeId: string | undefined, itemIds: string[]) =>
    ItemsService.bulkTrash(scopeId, itemIds),

  bulkRestore: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient.post<{ success: boolean; count: number; restoredIds: string[] }>(
      getCatalogUrl(scopeId || 'user', 'bulk-restore'),
      { itemIds },
    ),

  reindex: (scopeId: string | undefined, itemId: string) =>
    libraryClient.post<{ success?: boolean; message?: string; itemId?: string; data?: unknown }>(
      getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/reindex`),
      {},
    ).then((res) => res?.data || res || { success: true }),

  reResolve: (
    scopeId: string | undefined,
    itemId: string,
    options?: { attachOaPdf?: boolean; forceRefresh?: boolean },
  ) =>
    libraryClient
      .post<{
        success: boolean;
        updatedFields?: string[];
        oaPdfAttached?: boolean;
        oaPdfUrl?: string;
        item?: Item;
        data?: Item;
      }>(
        getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/re-resolve`),
        { attachOaPdf: true, ...options },
      )
      .then((res) => ({
        ...res,
        item:
          res?.item || res?.data
            ? unwrapItemResponse(res.item || res.data)
            : undefined,
      })),

  getItemTypes: (_scopeId?: string) =>
    libraryClient.get<Record<string, unknown>>(
      resolveLibraryRawPath('/api/v1/library/item-types', 'catalog'),
      { rawEnvelope: true },
    ),

  getItemType: (_scopeId: string | undefined, itemType: string) =>
    libraryClient.get<{ success: boolean; itemType: unknown; data: unknown }>(
      resolveLibraryRawPath(`/api/v1/library/item-types/${encodeURIComponent(itemType)}`, 'catalog'),
    ),

  getSchemaSnapshot: () =>
    libraryClient.get<{ success: boolean; data: Record<string, unknown> }>(
      resolveLibraryRawPath('/api/v1/library/types/schema', 'catalog'),
    ),

  validateItemPayload: (itemType: string, data: Record<string, unknown>) =>
    libraryClient.post<{
      success: boolean;
      valid: boolean;
      errors?: Array<{ field: string; message: string }>;
      warnings?: Array<{ field: string; message: string }>;
      sanitized?: Record<string, unknown>;
    }>(resolveLibraryRawPath('/api/v1/library/types/validate', 'catalog'), { itemType, data }),

  previewConvertType: (
    scopeId: string | undefined,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra: boolean = true,
  ) =>
    libraryClient.post<{ success: boolean; preview: unknown; data: unknown }>(
      getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/convert-type/preview`),
      { targetType, retainUnmappedInExtra },
    ),

  convertType: (
    scopeId: string | undefined,
    itemId: string,
    targetType: string,
    expectedVersion?: number,
    retainUnmappedInExtra: boolean = true,
  ) =>
    libraryClient.post<{ success: boolean; item?: Item; conversionReport: unknown }>(
      getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/convert-type`),
      { targetType, expectedVersion, retainUnmappedInExtra },
    ).then((res) => ({
      success: Boolean(res?.success ?? true),
      item: unwrapItemResponse(res?.item || res),
      conversionReport: res?.conversionReport,
    })),

  getFulltext: (scopeId: string | undefined, itemId: string): Promise<DocumentFulltext | null> =>
    libraryClient.get<Record<string, unknown>>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/fulltext`),
    ).then((res) => ((res as { data?: unknown })?.data || res || null) as DocumentFulltext | null).catch(() => null),

  getItemFileUrl,

  updateItem: (scopeId: string | undefined, itemId: string, data: Partial<Item>) =>
    ItemsService.update(scopeId || 'user', itemId, data),

  fetchPdfBlob,

  markMyPublication: (
    scopeId: string | undefined,
    itemId: string,
    options?: {
      contributorId?: string | null;
      isPublic?: boolean;
      openAccessLicense?: string | null;
      includeAttachments?: boolean;
      includeNotes?: boolean;
      authorshipConfirmed?: boolean;
    },
  ) => ItemsService.setMyPublication(scopeId, itemId, true, options),

  unmarkMyPublication: (scopeId: string | undefined, itemId: string) =>
    ItemsService.setMyPublication(scopeId, itemId, false),

  parseCitations: (scopeId: string | undefined, rawCitations: string) =>
    libraryClient.post<{
      success: boolean;
      count: number;
      references: Record<string, unknown>[];
      citations: Record<string, unknown>[];
    }>(
      getCatalogUrl(scopeId, 'citations/parse'),
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

  setMyPublication: (
    scopeId: string | undefined,
    itemId: string,
    isMyPublication: boolean,
    options?: {
      contributorId?: string | null;
      isPublic?: boolean;
      openAccessLicense?: string | null;
      includeAttachments?: boolean;
      includeNotes?: boolean;
      authorshipConfirmed?: boolean;
    },
  ) =>
    isMyPublication
      ? libraryClient.post<{ success: boolean; data: Item; item: Item }>(
          getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/my-publication`),
          options || {},
        ).then((res) => unwrapItemResponse(res?.item || res?.data || res))
      : libraryClient.delete<{ success: boolean; data: Item; item: Item }>(
          getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/my-publication`),
        ).then((res) => unwrapItemResponse(res?.item || res?.data || res)),
};

