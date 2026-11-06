import {
  type Item,
  type PaginatedItemsResponse,
  type CursorPaginationMeta,
  type ItemQueryParams,
  type RelatedItem,
  type SchemaItemTypeDefinition,
  normalizeRelationType,
} from '@/features/library/domain/types/core.types';
import type { DocumentFulltext } from '@/features/library/domain/types/reader.schema';
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

interface LibraryBootstrapResponse {
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
  collections?: import('@/features/library/domain/types/core.types').Collection[];
  savedSearches?: import('@/features/library/domain/types/core.types').SavedSearch[];
  tags?: import('./http.client').TagWithCount[];
  degraded?: boolean;
  degradedBranches?: string[];
  syncVersion?: {
    version: string;
    scope: 'user' | 'project';
    scopeId: string;
  };
  itemTypes?: Record<string, unknown>;
  feedSubscriptions?: import('./curation.client').FeedSubscriptionResponse[];
  items?: Item[];
  meta?: CursorPaginationMeta;
  pagination?: CursorPaginationMeta;
}

export interface ReaderBootstrapResponse {
  scope: 'user' | 'project';
  scopeId: string;
  degraded?: boolean;
  degradedBranches?: string[];
  item: Item;
  activeAttachmentId: string | null;
  annotations: import('@/features/library/domain/types/reader.schema').ReaderAnnotation[];
  fulltext: DocumentFulltext | null;
  readingState: import('./http.client').ItemStateData | null;
  relations: RelatedItem[];
  notes: import('@/features/library/domain/types/core.types').Note[];
  role?: import('@/features/library/domain/types/core.types').ProjectRole;
  permissions?: Partial<import('@/features/library/domain/types/core.types').LibraryPermissions> | string[];
}

// 1. ItemsService
export const ItemsService = {
  getReaderBootstrap: (
    scopeId: string | undefined,
    itemId: string,
    attachmentId?: string,
    options?: { signal?: AbortSignal },
  ) =>
    libraryClient
      .get<ReaderBootstrapResponse>(
        getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/reader-bootstrap`),
        {
          ...(attachmentId ? { params: { attachmentId } } : {}),
          signal: options?.signal,
        },
        scopeId,
      )
      .then((res) => {
        if (!res || typeof res !== 'object') return res;
        const mappedItem = res.item ? unwrapItemResponse(res.item) : res.item;
        if (mappedItem && res.readingState) {
          (mappedItem as Record<string, unknown>).readingState = res.readingState;
        }
        const normalizedRelations = Array.isArray(res.relations)
          ? res.relations.map((rel) => ({
              ...rel,
              relationType: normalizeRelationType(rel?.relationType),
            }))
          : [];
        return {
          ...res,
          item: mappedItem,
          relations: normalizedRelations,
        };
      }),

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
      const hasNextPage = Boolean(
        meta?.hasNextPage ?? (meta as { hasMore?: boolean } | undefined)?.hasMore,
      );
      const nextCursor = meta?.nextCursor ?? meta?.cursor ?? null;
      return {
        items,
        total,
        meta,
        pagination: meta,
        hasNextPage,
        nextCursor,
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

  emptyTrash: (scopeId: string | undefined) =>
    libraryClient
      .delete<{
        success?: boolean;
        count?: number;
        purgedCount?: number;
        succeededIds?: string[];
        failedIds?: string[];
      }>(getCatalogUrl(scopeId || 'user', 'trash'))
      .then((res) => {
        const succeededIds = res?.succeededIds ?? [];
        const count = res?.purgedCount ?? res?.count ?? succeededIds.length;
        return {
          success: res?.success ?? true,
          count,
          purgedCount: count,
          succeededIds,
          failedIds: res?.failedIds ?? [],
        };
      }),

  bulkPurge: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient
      .post<{
        success?: boolean;
        count?: number;
        purgedCount?: number;
        purgedIds?: string[];
        succeededIds?: string[];
        failedIds?: string[];
      }>(getCatalogUrl(scopeId || 'user', 'bulk-purge'), { itemIds })
      .then((res) => {
        const succeededIds = res?.succeededIds ?? res?.purgedIds ?? itemIds;
        const count = res?.count ?? res?.purgedCount ?? succeededIds.length;
        return {
          success: res?.success ?? true,
          count,
          purgedCount: count,
          purgedIds: succeededIds,
          succeededIds,
          failedIds: res?.failedIds ?? [],
        };
      }),

  bulkTrash: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient
      .post<{
        success?: boolean;
        count?: number;
        trashedCount?: number;
        trashedIds?: string[];
        succeededIds?: string[];
        failedIds?: string[];
      }>(getCatalogUrl(scopeId || 'user', 'bulk-trash'), { itemIds })
      .then((res) => {
        const succeededIds = res?.succeededIds ?? res?.trashedIds ?? itemIds;
        const count = res?.count ?? res?.trashedCount ?? succeededIds.length;
        return {
          success: res?.success ?? true,
          count,
          trashedCount: count,
          trashedIds: succeededIds,
          succeededIds,
          failedIds: res?.failedIds ?? [],
        };
      }),

  bulkDelete: (scopeId: string | undefined, itemIds: string[]) =>
    ItemsService.bulkTrash(scopeId, itemIds),

  bulkRestore: (scopeId: string | undefined, itemIds: string[]) =>
    libraryClient
      .post<{
        success?: boolean;
        count?: number;
        restoredCount?: number;
        restoredIds?: string[];
        succeededIds?: string[];
        failedIds?: string[];
      }>(getCatalogUrl(scopeId || 'user', 'bulk-restore'), { itemIds })
      .then((res) => {
        const succeededIds = res?.succeededIds ?? res?.restoredIds ?? itemIds;
        const count = res?.count ?? res?.restoredCount ?? succeededIds.length;
        return {
          success: res?.success ?? true,
          count,
          restoredCount: count,
          restoredIds: succeededIds,
          succeededIds,
          failedIds: res?.failedIds ?? [],
        };
      }),

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
        message?: string;
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
      resolveLibraryUrl('reader', '/items', scopeId, `${encodeURIComponent(itemId)}/fulltext`),
    ).then((res) => ((res as { data?: unknown })?.data || res || null) as DocumentFulltext | null).catch(() => null),

  getItemFileUrl,

  updateItem: (scopeId: string | undefined, itemId: string, data: Partial<Item>) =>
    ItemsService.update(scopeId || 'user', itemId, data),

  fetchPdfBlob,

  getRelated: (scopeId: string | undefined, itemId: string) =>
    RelationsService.getRelated(scopeId, itemId),

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

