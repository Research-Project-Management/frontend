/**
 * library.client.ts
 *
 * UNIFIED LIBRARY CLIENT SDK & TRANSPORT (Deep Module Pattern)
 *
 * Single Source of Truth for all Library API and Microservice operations:
 * 1. Transport & URL Resolution:
 *    - Defaults to `/api/v1` (Monolith or unified API Gateway).
 *    - Standalone microservice host support via `NEXT_PUBLIC_LIBRARY_SERVICES_URL`.
 *    - Single-tenant scope semantics: Personal ('user') and Project ('projectId' via `X-Project-Id`).
 * 2. Unified Service Domain Operations (`libraryServices`):
 *    - items, collections, tags, notes, savedSearches, relations
 *    - citations, exports, attachments, upload, ingestion, curation, retraction, search, sync, reader
 * 3. Domain Services & Helpers:
 *    - ReaderService / readerService
 *    - fetchPdfBlob, getItemFileUrl, sanitizeItemPayload
 */

import * as api from '@/shared/lib/api';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';
import type { RequestOptions } from '@/shared/types/api.types';
import { isProjectScope, getItemFileUrl } from '@/features/library/domain/item-url';
import { mapBackendItem } from '@/features/library/domain/metadata';
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
  FormattedCitation,
  CslStyle,
  ReferenceData,
  CslStyleMetadata,
  ItemAttachment,
  SearchResponse,
  SearchSortBy,
  SearchSortOrder,
  DuplicateGroup,
  LibraryIntegrityReport,
  FlagRetractionInput,
  RetractionStats,
} from '@/features/library/domain/types/library.types';
import type {
  ReaderDocument,
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  DocumentReadingState,
  DocumentFulltext,
} from '@/features/library/domain/types/reader.types';
import {
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

export { isProjectScope, getItemFileUrl, mapBackendItem };
export type {
  TagWithCount,
  ItemStateData,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchConditionGroup,
  ReferenceData,
  CslStyleMetadata,
};

export type LibrarySubdomain =
  | 'catalog'
  | 'extraction'
  | 'ingestion'
  | 'citation'
  | 'search'
  | 'sync'
  | 'reader';

// Base URL & Endpoint Resolution

function normalizeServiceHost(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '/api/v1/library' || trimmed === '/api/v1' || trimmed === '/') {
    return '';
  }
  return trimmed
    .replace(/\/api\/v1\/library$/i, '')
    .replace(/\/api\/v1$/i, '');
}

export function getLibraryServiceHost(_domain?: LibrarySubdomain): string {
  const rawConfigured =
    process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof API_BASE_URL === 'string' && API_BASE_URL !== 'undefined' && API_BASE_URL !== 'null'
      ? API_BASE_URL
      : '');
  return normalizeServiceHost(rawConfigured);
}

export function resolveLibraryUrl(
  _domain: LibrarySubdomain,
  resourcePath: string,
  scopeId?: string,
  suffix = '',
): string {
  const host = getLibraryServiceHost();
  const cleanResource = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  const cleanSuffix = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '';

  const basePath = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library${cleanResource}${cleanSuffix}`
    : `/api/v1/library${cleanResource}${cleanSuffix}`;

  return host ? `${host}${basePath}` : basePath;
}

export function resolveLibraryRawPath(path: string, _domain?: LibrarySubdomain): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const host = getLibraryServiceHost();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return host ? `${host}${cleanPath}` : cleanPath;
}

function withLibraryServiceOptions(
  url: string,
  options?: RequestOptions,
  scopeId?: string,
): RequestOptions | undefined {
  const token = !options?.skipAuth ? getAuthToken() : null;
  const extraHeaders: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (token && !extraHeaders['Authorization']) {
    extraHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (isProjectScope(scopeId) && !extraHeaders['X-Project-Id']) {
    extraHeaders['X-Project-Id'] = scopeId!;
  }

  return {
    ...options,
    headers: extraHeaders,
  };
}

export const libraryClient = {
  resolveUrl: resolveLibraryUrl,
  resolveRawPath: resolveLibraryRawPath,

  get<T>(url: string, options?: RequestOptions, scopeId?: string): Promise<T> {
    const resolvedUrl = resolveLibraryRawPath(url);
    const effectiveOptions = withLibraryServiceOptions(resolvedUrl, options, scopeId);
    return effectiveOptions !== undefined
      ? api.apiGet<T>(resolvedUrl, effectiveOptions)
      : api.apiGet<T>(resolvedUrl);
  },

  post<T>(url: string, body?: unknown, options?: RequestOptions, scopeId?: string): Promise<T> {
    const resolvedUrl = resolveLibraryRawPath(url);
    const effectiveOptions = withLibraryServiceOptions(resolvedUrl, options, scopeId);
    if (effectiveOptions !== undefined) {
      return api.apiPost<T>(resolvedUrl, body, effectiveOptions);
    }
    return body !== undefined ? api.apiPost<T>(resolvedUrl, body) : api.apiPost<T>(resolvedUrl);
  },

  put<T>(url: string, body?: unknown, options?: RequestOptions, scopeId?: string): Promise<T> {
    const resolvedUrl = resolveLibraryRawPath(url);
    const effectiveOptions = withLibraryServiceOptions(resolvedUrl, options, scopeId);
    if (effectiveOptions !== undefined) {
      return api.apiPut<T>(resolvedUrl, body, effectiveOptions);
    }
    return body !== undefined ? api.apiPut<T>(resolvedUrl, body) : api.apiPut<T>(resolvedUrl);
  },

  patch<T>(url: string, body?: unknown, options?: RequestOptions, scopeId?: string): Promise<T> {
    const resolvedUrl = resolveLibraryRawPath(url);
    const effectiveOptions = withLibraryServiceOptions(resolvedUrl, options, scopeId);
    if (effectiveOptions !== undefined) {
      return api.apiPatch<T>(resolvedUrl, body, effectiveOptions);
    }
    return body !== undefined ? api.apiPatch<T>(resolvedUrl, body) : api.apiPatch<T>(resolvedUrl);
  },

  delete<T>(url: string, options?: RequestOptions, scopeId?: string): Promise<T> {
    const resolvedUrl = resolveLibraryRawPath(url);
    const effectiveOptions = withLibraryServiceOptions(resolvedUrl, options, scopeId);
    return effectiveOptions !== undefined
      ? api.apiDelete<T>(resolvedUrl, effectiveOptions)
      : api.apiDelete<T>(resolvedUrl);
  },
};

// Scope URL Helpers

function getCatalogUrl(scopeId?: string, suffix = ''): string {
  if (!suffix) {
    return resolveLibraryUrl('catalog', '/items', scopeId);
  }
  const cleanSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  const resourcePath = cleanSuffix.startsWith('/items') ? cleanSuffix : `/items${cleanSuffix}`;
  return resolveLibraryUrl('catalog', resourcePath, scopeId);
}

function getCitationUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('citation', '/citation', scopeId, suffix);
}

function getExportsUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('citation', '/exports', scopeId, suffix);
}

function getIngestionUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('ingestion', '/ingestion', scopeId, suffix);
}

function getCurationUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('ingestion', '/curation', scopeId, suffix);
}

function getRetractionUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('ingestion', '/retraction', scopeId, suffix);
}

function getSyncUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('sync', '/sync', scopeId, suffix);
}

function getItemAttachmentUrl(scopeId: string | undefined, itemId: string, suffix = ''): string {
  return resolveLibraryUrl(
    'extraction',
    `/items/${encodeURIComponent(itemId)}/attachments`,
    scopeId,
    suffix,
  );
}

function getAttachmentUrl(scopeId: string | undefined, attachmentId: string, suffix = ''): string {
  return resolveLibraryUrl(
    'extraction',
    `/attachments/${encodeURIComponent(attachmentId)}`,
    scopeId,
    suffix,
  );
}

// Generic Payload Cleaner

export function sanitizeItemPayload(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && typeof value !== 'function' && !key.startsWith('_')) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

const inFlightPdfBlobRequests = new Map<string, Promise<Blob>>();
const MAX_CACHED_PDF_BLOBS = 3;
const MAX_CACHED_PDF_BLOB_BYTES = 30 * 1024 * 1024;
const PDF_BLOB_CACHE_TTL_MS = 2 * 60 * 1000;

interface CachedPdfBlobEntry {
  blob: Blob;
  cachedAt: number;
}

const pdfBlobLruCache = new Map<string, CachedPdfBlobEntry>();

function getCachedPdfBlob(url: string): Blob | null {
  const entry = pdfBlobLruCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > PDF_BLOB_CACHE_TTL_MS) {
    pdfBlobLruCache.delete(url);
    return null;
  }
  pdfBlobLruCache.delete(url);
  pdfBlobLruCache.set(url, entry);
  return entry.blob;
}

function setCachedPdfBlob(url: string, blob: Blob): void {
  if (blob.size <= 0 || blob.size > MAX_CACHED_PDF_BLOB_BYTES) return;
  if (pdfBlobLruCache.has(url)) {
    pdfBlobLruCache.delete(url);
  } else if (pdfBlobLruCache.size >= MAX_CACHED_PDF_BLOBS) {
    const oldestKey = pdfBlobLruCache.keys().next().value;
    if (oldestKey !== undefined) {
      pdfBlobLruCache.delete(oldestKey);
    }
  }
  pdfBlobLruCache.set(url, { blob, cachedAt: Date.now() });
}

function awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

export const fetchPdfBlob = async (url: string, signal?: AbortSignal): Promise<Blob> => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid document URL provided.');
  }

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const targetUrl = url.trim();
  const cachedBlob = getCachedPdfBlob(targetUrl);
  if (cachedBlob) {
    return cachedBlob;
  }

  const existingInFlight = inFlightPdfBlobRequests.get(targetUrl);
  if (existingInFlight) {
    return awaitWithSignal(existingInFlight, signal);
  }

  const executeFetch = async (): Promise<Blob> => {
    const isLocalStatic = targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');
    const libraryHost = getLibraryServiceHost();
    const rawApiBase =
      libraryHost ||
      (typeof API_BASE_URL === 'string' && API_BASE_URL !== 'undefined' && API_BASE_URL !== 'null'
        ? API_BASE_URL.trim()
        : '');

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
        const libOrigin = libraryHost ? new URL(libraryHost, baseUrl).origin : apiOrigin;
        isTrustedOrigin =
          resolvedOrigin === new URL(baseUrl).origin ||
          resolvedOrigin === apiOrigin ||
          resolvedOrigin === libOrigin ||
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
          errorDetail = text.slice(0, 140);
        }
      } catch {
        // Ignore parse failure
      }
      throw new Error(
        errorDetail
          ? `Server returned an error instead of PDF: ${errorDetail}`
          : 'Server returned HTML or JSON instead of a binary PDF file.',
      );
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Received an empty file from server.');
    }
    setCachedPdfBlob(targetUrl, blob);
    return blob;
  };

  const promise = executeFetch().finally(() => {
    inFlightPdfBlobRequests.delete(targetUrl);
  });
  inFlightPdfBlobRequests.set(targetUrl, promise);
  return awaitWithSignal(promise, signal);
};

function toIngestionSubmission(payload: UnifiedIngestionPayload): Record<string, unknown> {
  const p = payload as Record<string, unknown>;
  const source = p.source as string;
  const base = {
    source,
    collectionId: p.collectionId,
    allowDuplicates: p.allowDuplicates,
    overrides: p.overrides,
    idempotencyKey: p.idempotencyKey,
  };
  if (source === 'doi') {
    return {
      ...base,
      kind: 'IDENTIFIER',
      identifierType: 'DOI',
      value: p.doi,
      identifierValue: p.doi,
      doi: p.doi,
    };
  }
  if (source === 'arxiv') {
    return {
      ...base,
      kind: 'IDENTIFIER',
      identifierType: 'ARXIV',
      value: p.arxivId,
      identifierValue: p.arxivId,
      arxivId: p.arxivId,
    };
  }
  if (source === 'isbn') {
    return {
      ...base,
      kind: 'IDENTIFIER',
      identifierType: 'ISBN',
      value: p.isbn,
      identifierValue: p.isbn,
      isbn: p.isbn,
    };
  }
  if (source === 'pmid') {
    return {
      ...base,
      kind: 'IDENTIFIER',
      identifierType: 'PMID',
      value: p.pmid,
      identifierValue: p.pmid,
      pmid: p.pmid,
    };
  }
  if (source === 'bibtex') {
    return {
      ...base,
      kind: 'RECORD',
      format: 'BIBTEX',
      recordFormat: 'BIBTEX',
      content: p.content || p.bibtex,
    };
  }
  if (source === 'ris') {
    return {
      ...base,
      kind: 'RECORD',
      format: 'RIS',
      recordFormat: 'RIS',
      content: p.content || p.ris,
    };
  }
  if (source === 'url') {
    return {
      ...base,
      kind: 'URL',
      url: p.url,
      previewToken: p.previewToken,
    };
  }
  if (source === 'pdf') {
    return {
      ...base,
      kind: 'FILE',
      fileId: p.fileId,
      filename: p.filename,
      autoExtract: p.autoExtract,
      enableOcr: p.enableOcr,
    };
  }
  if (source === 'zotero' || source === 'connector') {
    return {
      ...base,
      kind: 'CONNECTOR',
      connectionId: p.connectionId,
      externalObjectId: p.externalItemKey || p.externalObjectId,
      externalVersion: p.externalVersion,
    };
  }
  if (source === 'manual') return { ...base, kind: 'RECORD', item: p.item };
  return {
    ...base,
    kind: p.kind || (p.fileId ? 'FILE' : 'URL'),
  };
}

function unwrapList<T>(res: unknown, key: string): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function unwrapRecord<T>(res: unknown, key: string): T | null {
  if (!res || typeof res !== 'object') return null;
  const obj = res as Record<string, unknown>;
  if (key in obj && obj[key] && typeof obj[key] === 'object') {
    return obj[key] as T;
  }
  if ('data' in obj && obj.data && typeof obj.data === 'object') {
    return obj.data as T;
  }
  return res as T;
}

function unwrapItemResponse(res: unknown): Item {
  const obj = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const rawItem = ((obj.item || obj.data || res) ?? {}) as Item;
  return mapBackendItem(rawItem);
}

function unwrapResolvedReference(raw: unknown): ReferenceData | null {
  if (!raw || typeof raw !== 'object') return null;
  const res = raw as Record<string, unknown>;
  if (res.found === false) return null;
  const candidate = (res.metadata || res.work || res.data || res) as Partial<ReferenceData> | undefined;
  if (candidate && typeof candidate === 'object') {
    return { ...candidate, title: candidate.title || '' } as ReferenceData;
  }
  return null;
}

// DOMAIN SERVICES & FACADES

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

// 1. ItemsService
export const ItemsService = {
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

  getItemTypes: (_scopeId?: string) =>
    libraryClient.get<Record<string, unknown>>(
      `/api/v1/library/item-types`,
      { rawEnvelope: true },
    ),

  getItemType: (_scopeId: string | undefined, itemType: string) =>
    libraryClient.get<{ success: boolean; itemType: unknown; data: unknown }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
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
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/fulltext`),
    ).then((res) => ((res as { data?: unknown })?.data || res || null) as DocumentFulltext | null).catch(() => null),

  getItemFileUrl,

  updateItem: (scopeId: string | undefined, itemId: string, data: Partial<Item>) =>
    ItemsService.update(scopeId || 'user', itemId, data),

  fetchPdfBlob,

  markMyPublication: (scopeId: string | undefined, itemId: string) =>
    ItemsService.setMyPublication(scopeId, itemId, true),

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

  setMyPublication: (scopeId: string | undefined, itemId: string, isMyPublication: boolean) =>
    isMyPublication
      ? libraryClient.post<{ success: boolean; data: Item; item: Item }>(
          getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/my-publication`),
          {},
        ).then((res) => unwrapItemResponse(res?.item || res?.data || res))
      : libraryClient.delete<{ success: boolean; data: Item; item: Item }>(
          getCatalogUrl(scopeId || 'user', `${encodeURIComponent(itemId)}/my-publication`),
        ).then((res) => unwrapItemResponse(res?.item || res?.data || res)),
};

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
    libraryClient.post<{ count: number; collectionId: string }>(
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
    libraryClient.delete<{ detached: boolean }>(
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
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.post<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(scopeId),
      {
        name,
        color,
        type,
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

  removeFromItem: async (
    scopeId: string | undefined,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await libraryClient.delete<unknown>(
      getTagsUrl(scopeId, `${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`),
    );
  },

  detachFromItem: (scopeId: string | undefined, itemId: string, tagId: string) =>
    TagsService.removeFromItem(scopeId, tagId, itemId),
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
    options?: { noteId?: string; tagColor?: boolean; tagColorName?: string; includeComments?: boolean },
  ): Promise<Note> => {
    const raw = await libraryClient.post<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(scopeId, `items/${encodeURIComponent(itemId)}/from-annotations`),
      options || {},
    );
    return unwrapNoteResponse(raw);
  },

  extractNotes: (
    scopeId: string | undefined,
    itemId: string,
    options?: { noteId?: string; tagColor?: boolean; includeComments?: boolean },
  ): Promise<Note> => NotesService.extractFromAnnotations(scopeId, itemId, options),
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
    >(getCatalogUrl(scopeId, 'state/batch'), { itemIds: itemIds ?? [] });
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

  create: (scopeId: string | undefined, data: CreateSavedSearchInput) =>
    libraryClient.post<SavedSearch>(
      resolveLibraryUrl('catalog', '/saved-searches', scopeId),
      {
        ...data,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    ),

  update: (scopeId: string | undefined, id: string, data: UpdateSavedSearchInput) =>
    libraryClient.patch<SavedSearch>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, scopeId),
      data,
    ),

  delete: (scopeId: string | undefined, id: string) =>
    libraryClient.delete<{ success: boolean; id: string }>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, scopeId),
    ),

  preview: (scopeId: string | undefined, conditions: SavedSearchConditionGroup) =>
    libraryClient.post<SavedSearchPreviewResponse>(
      resolveLibraryUrl('catalog', '/saved-searches/preview', scopeId),
      {
        conditions,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    ),

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
  ) =>
    libraryClient.get<SavedSearchResultsResponse>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}/execute`, scopeId),
      params ? { params } : undefined,
    ),

  execute: (scopeId: string | undefined, id: string, params?: { page?: number; limit?: number }) =>
    SavedSearchesService.getResults(scopeId, id, params),
};

// 7. RelationsService
export const RelationsService = {
  getRelated: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<{ relatedItems?: RelatedItem[]; total?: number }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/relations`),
    ).then((res) => {
      const items = res?.relatedItems ?? [];
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
    const payload = Array.isArray(targetItemId)
      ? { targetItemIds: targetItemId, relationType }
      : { targetItemId, relationType };
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

// 8. Citations & Exports Services
export const CitationService = {
  formatCitation: (scopeId: string | undefined, itemId: string, style: CslStyle = 'apa', index = 1) => {
    const pQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<FormattedCitation>(
      `${getCitationUrl(scopeId, 'items')}/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(style)}&index=${index}${pQuery}`,
    );
  },

  batchFormat: (scopeId: string | undefined, itemIds: string[], style: CslStyle = 'apa') => {
    const projectId = isProjectScope(scopeId) ? scopeId : undefined;
    return libraryClient.post<{
      style: CslStyle;
      total: number;
      combinedInText?: string;
      bibliographyText?: string;
      bibliographyHtml?: string;
      citations: Array<{ itemId?: string; citation: FormattedCitation }>;
    }>(getCitationUrl(scopeId, 'batch-items'), {
      itemIds,
      style,
      ...(projectId ? { projectId } : {}),
    });
  },

  getStyles: (scopeId?: string) => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<import('@/features/library/domain/types/library.types').StyleSummary[]>(
      `${getCitationUrl(scopeId, 'styles')}${pQuery}`,
    );
  },

  searchStyles: (query = '', limit = 30) =>
    libraryClient.get<{ styles: CslStyleMetadata[]; total: number }>(
      `/api/v1/library/citation/styles/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  uploadCustomStyle: (xml: string, title?: string) =>
    libraryClient.post<{ styleId?: string; id?: string; title: string; message: string }>(
      `/api/v1/library/citation/styles/custom`,
      { xml, title },
    ).then((res) => ({
      ...res,
      id: res.id || res.styleId || '',
      styleId: res.styleId || res.id || '',
    })),

  resolveDoi: async (doi: string, _scopeId?: string): Promise<ReferenceData | null> => {
    const rawDoi = typeof doi === 'string' ? doi.trim() : '';
    if (!rawDoi) throw new Error('Invalid DOI provided');
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        `/api/v1/library/citation/resolve`,
        { doi: rawDoi, query: rawDoi },
        { silent: true },
      );
      const unwrapped = unwrapResolvedReference(referenceResponse);
      if (unwrapped) return unwrapped;
    } catch {
      return null;
    }
    return null;
  },

  fetchByDoi: (doi: string, scopeId?: string) => CitationService.resolveDoi(doi, scopeId),

  search: async (query: string, _scopeId?: string): Promise<ReferenceData[]> => {
    if (!query || !query.trim()) return [];
    const trimmedQuery = query.trim();
    try {
      const response = await libraryClient.get<{
        works?: ReferenceData[];
        results?: ReferenceData[];
        data?: ReferenceData[];
      }>(`/api/v1/library/citation/crossref/search?query=${encodeURIComponent(trimmedQuery)}&rows=10`, { silent: true });
      if (response?.works && Array.isArray(response.works)) return response.works;
      if (response?.results && Array.isArray(response.results)) return response.results;
      if (response?.data && Array.isArray(response.data)) return response.data;
      if (Array.isArray(response)) return response as ReferenceData[];
      return [];
    } catch {
      return [];
    }
  },

  resolve: async (query: string, scopeId?: string): Promise<ReferenceData | null> => {
    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (!trimmed) return null;
    try {
      const referenceResponse = await libraryClient.post<unknown>(
        `/api/v1/library/citation/resolve`,
        { query: trimmed },
        { silent: true },
      );
      const unwrapped = unwrapResolvedReference(referenceResponse);
      if (unwrapped) return unwrapped;
    } catch {
      // Fall back to search
    }
    const results = await CitationService.search(trimmed, scopeId);
    return results.length > 0 ? results[0] : null;
  },
};

export const ExportsService = {
  exportLibrary: (
    scopeId?: string,
    options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      projectId?: string;
    },
  ) => {
    const projectId = options?.projectId || (isProjectScope(scopeId) ? scopeId : undefined);
    return libraryClient.post<{ content: string; filename: string; itemCount: number }>(
      getExportsUrl(scopeId),
      { ...options, ...(projectId ? { projectId } : {}) },
    );
  },

  exportByCitationKeys: (scopeId: string, keys: string[]) =>
    libraryClient.post<{ content: string; filename: string; itemCount: number }>(
      `${getExportsUrl(scopeId)}/by-keys`,
      { keys, format: 'bibtex' },
    ),

  exportAnnotatedPdf: (scopeId?: string, itemId?: string) => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<{ filename: string; mimeType: string; base64: string }>(
      `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId || '')}/annotated-pdf${pQuery}`,
    );
  },

  downloadAnnotatedPdf: async (
    scopeId: string | undefined,
    itemId: string,
    fallbackFilename = `annotated_${itemId}.pdf`,
  ): Promise<{ filename: string; mimeType: string }> => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    const endpoint = `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId)}/annotated-pdf${pQuery}`;
    let resolvedFilename = fallbackFilename;
    const res = await libraryClient.get<{ filename: string; mimeType: string; base64: string }>(endpoint);
    if (!res || !res.base64) {
      throw new Error('Failed to generate annotated PDF: No content received');
    }
    if (res.filename) {
      resolvedFilename = res.filename;
    }
    const byteCharacters = atob(res.base64);
    const sliceSize = 32_768;
    const byteArrays: Uint8Array<ArrayBuffer>[] = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const end = Math.min(offset + sliceSize, byteCharacters.length);
      const bytes = new Uint8Array(end - offset);
      for (let i = offset; i < end; i++) {
        bytes[i - offset] = byteCharacters.charCodeAt(i);
      }
      byteArrays.push(bytes);
    }
    const blob = new Blob(byteArrays, { type: res.mimeType || 'application/pdf' });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedFilename;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    }
    return { filename: resolvedFilename, mimeType: 'application/pdf' };
  },
};

export const downloadAnnotatedPdf = ExportsService.downloadAnnotatedPdf;

// 9. Extraction, Attachments & Upload Services
export const AttachmentsService = {
  list: async (scopeId: string, itemId: string): Promise<ItemAttachment[]> => {
    const res = await libraryClient.get<{ attachments: ItemAttachment[] }>(getItemAttachmentUrl(scopeId, itemId));
    return res.attachments || [];
  },

  get: async (scopeId: string, attachmentId: string): Promise<ItemAttachment> => {
    const res = await libraryClient.get<{ attachment?: ItemAttachment } | ItemAttachment>(getAttachmentUrl(scopeId, attachmentId));
    if (res && typeof res === 'object' && 'attachment' in res && res.attachment) {
      return res.attachment;
    }
    return res as ItemAttachment;
  },

  delete: async (scopeId: string, attachmentId: string): Promise<boolean> => {
    const res = await libraryClient.delete<{ success: boolean }>(getAttachmentUrl(scopeId, attachmentId));
    return res.success;
  },

  create: async (scopeId: string, itemId: string, data: Record<string, unknown>): Promise<ItemAttachment> => {
    const res = await libraryClient.post<{ attachment?: ItemAttachment } | ItemAttachment>(
      getItemAttachmentUrl(scopeId, itemId),
      data,
    );
    return (res as { attachment?: ItemAttachment }).attachment ?? (res as ItemAttachment);
  },

  captureSnapshot: async (scopeId: string, itemId: string, url?: string): Promise<ItemAttachment> => {
    const res = await libraryClient.post<{ attachment?: ItemAttachment } | ItemAttachment>(
      getItemAttachmentUrl(scopeId, itemId, 'snapshot'),
      url ? { url } : {},
    );
    return (res as { attachment?: ItemAttachment }).attachment ?? (res as ItemAttachment);
  },

  rename: async (scopeId: string, attachmentId: string, dto: { filename?: string; pattern?: string }) =>
    libraryClient.patch<{ attachment: ItemAttachment; oldFilename: string; newFilename: string }>(
      getAttachmentUrl(scopeId, attachmentId, 'rename'),
      dto,
    ),

  batchRename: async (scopeId: string, dto: { itemIds?: string[]; attachmentIds?: string[]; pattern?: string }) =>
    libraryClient.post<{
      renamedCount: number;
      results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
    }>(resolveLibraryUrl('extraction', '/attachments/batch-rename', scopeId), dto),

  reExtract: async (scopeId: string | undefined, attachmentId: string) =>
    libraryClient.post<{ status: string; attachmentId: string; message: string }>(
      getAttachmentUrl(scopeId, attachmentId, 're-extract'),
      {},
    ),

  setPrimary: (scopeId: string, itemId: string, attachmentId: string) =>
    libraryClient.post<{ success: boolean }>(
      getItemAttachmentUrl(scopeId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
      {},
    ),
};

export const UploadService = {
  uploadMultipart: async (
    scopeId: string | undefined,
    file: File,
    options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
  ): Promise<{ fileId: string; url: string; filename: string; size: number; mimeType: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (isProjectScope(scopeId)) {
      formData.append('projectId', scopeId!);
    }
    const uploadUrl = resolveLibraryUrl('extraction', '/upload', scopeId);
    const res = await libraryClient.post<{
      fileId: string;
      url: string;
      filename?: string;
      size?: number;
      mimeType?: string;
    }>(uploadUrl, formData, {
      signal: options?.signal,
    }, scopeId);
    return {
      fileId: res.fileId,
      url: res.url,
      filename: res.filename || file.name,
      size: res.size ?? file.size,
      mimeType: res.mimeType || file.type || 'application/pdf',
    };
  },
};

// 10. Ingestion, Curation & Retraction Services
export const IngestionService = {
  ingest: async (scopeId: string | undefined, payload: UnifiedIngestionPayload): Promise<UnifiedIngestionResponse> => {
    const validated = UnifiedIngestionPayloadSchema.parse(payload);
    const submission = {
      ...toIngestionSubmission(validated),
      ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
    };
    const res = await libraryClient.post<Record<string, unknown>>(
      getIngestionUrl(scopeId, 'submit'),
      submission,
      { timeout: 30000 },
    );
    const accepted = (res && typeof res === 'object' && 'data' in res && res.data ? res.data : res) as Record<string, unknown>;
    return UnifiedIngestionResponseSchema.parse({
      success: true,
      data: {
        runId: accepted.runId,
        status: accepted.status,
        itemId: accepted.existingItemId,
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
      previewToken?: string;
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

export const CurationService = {
  getDuplicates: async (
    scopeId?: string,
  ): Promise<{ duplicateGroups: DuplicateGroup[]; totalDuplicates: number }> => {
    interface RawDuplicateCluster {
      clusterId: string;
      matchReason: string;
      confidence: number;
      recommendedMasterId?: string;
      items: Array<Record<string, unknown>>;
    }
    const res = await libraryClient.get<
      RawDuplicateCluster[] | { data?: RawDuplicateCluster[]; clusters?: RawDuplicateCluster[]; duplicates?: DuplicateGroup[] }
    >(getCurationUrl(scopeId, 'duplicates'));

    if (res && typeof res === 'object' && 'duplicates' in res && Array.isArray(res.duplicates)) {
      return {
        duplicateGroups: res.duplicates,
        totalDuplicates: res.duplicates.reduce((acc, g) => acc + (g.items?.length || 0), 0),
      };
    }

    const clusters: RawDuplicateCluster[] = Array.isArray(res)
      ? res
      : (res && 'data' in res && Array.isArray(res.data)
          ? res.data
          : res && 'clusters' in res && Array.isArray(res.clusters)
            ? res.clusters
            : []);

    const duplicateGroups: DuplicateGroup[] = clusters.map((c) => {
      const parsedItems = (c.items || []).map((it) => {
        const rawTags = Array.isArray(it.tags)
          ? it.tags
              .map((t: unknown) =>
                typeof t === 'string'
                  ? t
                  : t && typeof t === 'object' && 'name' in t
                    ? String((t as { name: unknown }).name)
                    : '',
              )
              .filter(Boolean)
          : undefined;
        const mapped = {
          ...mapBackendItem(it),
          ...(rawTags ? { tags: rawTags } : {}),
        };
        const parseRes = itemSchema.safeParse(mapped);
        return {
          ...mapped,
          ...(parseRes.success ? parseRes.data : {}),
        };
      });
      return {
        matchType: c.matchReason === 'EXACT_DOI' ? 'DOI' : 'TITLE_AUTHOR_YEAR',
        confidence: c.confidence >= 1 ? 'high' : 'medium',
        key: c.clusterId,
        ...(c.recommendedMasterId ? { recommendedMasterId: c.recommendedMasterId } : {}),
        items: parsedItems,
      };
    });

    return {
      duplicateGroups,
      totalDuplicates: duplicateGroups.reduce(
        (acc, g) => acc + (g.items?.length || 0),
        0,
      ),
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

  getIntegrityReport: async (scopeId?: string): Promise<LibraryIntegrityReport> => {
    const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<LibraryIntegrityReport>(`${getCurationUrl(scopeId, 'integrity')}${pQuery}`);
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

  getRetractedItems: (scopeId?: string) =>
    libraryClient.get<Item[]>(
      getRetractionUrl(scopeId, 'items'),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

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

  flagItem: ((
    scopeId: string | undefined,
    itemIdOrInput: string | FlagRetractionInput,
    data?: FlagRetractionInput,
  ) => {
    if (typeof itemIdOrInput === 'string') {
      return libraryClient.post<Item>(
        getRetractionUrl(scopeId, `items/${encodeURIComponent(itemIdOrInput)}/flag`),
        data || {},
        { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
      );
    }
    return libraryClient.post<{ success: boolean }>(getRetractionUrl(scopeId, 'flag'), itemIdOrInput);
  }) as {
    (scopeId: string | undefined, itemId: string, data: FlagRetractionInput): Promise<Item>;
    (scopeId: string | undefined, input: FlagRetractionInput): Promise<{ success: boolean }>;
  },

  unflagItem: (scopeId: string | undefined, itemId: string) =>
    libraryClient.delete<Item>(
      getRetractionUrl(scopeId, `items/${encodeURIComponent(itemId)}/flag`),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
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
  }, scopeId?: string) => {
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

    return libraryClient.get<SearchResponse>(
      resolveLibraryUrl('search', '/search', scopeId),
      { params: queryParams },
    );
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
    libraryClient.get<{ since: string; count: number; hasMore: boolean; changes: Array<Record<string, unknown>> }>(
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

// 12. Reader Services
const ReaderDocumentsService = {
  get: async (scopeId: string | undefined, itemId: string): Promise<ReaderDocument> => {
    const item = await ItemsService.getById(scopeId || 'user', itemId);
    return item as ReaderDocument;
  },

  update: async (
    scopeId: string | undefined,
    itemId: string,
    data: Partial<ReaderDocument>,
  ): Promise<ReaderDocument> => {
    const updated = await ItemsService.updateItem(
      scopeId,
      itemId,
      data as Parameters<typeof ItemsService.updateItem>[2],
    );
    return updated as ReaderDocument;
  },

  reindex: ItemsService.reindex,

  getFulltext: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<DocumentFulltext | null> => {
    const res = await ItemsService.getFulltext(scopeId, itemId);
    if (!res) return null;
    return unwrapRecord<DocumentFulltext>(res, 'data') ?? (res as DocumentFulltext);
  },

  getMetadataSources: ItemsService.getMetadataSources,
};

const ReaderAnnotationsService = {
  getByAttachment: async (scopeId: string | undefined, attachmentId: string): Promise<ReaderAnnotation[]> => {
    if (!attachmentId) return [];
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
    const res = await libraryClient.get<ReaderAnnotation[] | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] }>(url);
    return unwrapList<ReaderAnnotation>(res, 'annotations');
  },

  create: async (scopeId: string | undefined, attachmentId: string, dto: CreateAnnotationDto): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
    return libraryClient.post<ReaderAnnotation>(url, dto);
  },

  update: async (
    scopeId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion: number | undefined,
    dto: UpdateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      scopeId,
    );
    return libraryClient.patch<ReaderAnnotation>(url, { ...dto, expectedVersion });
  },

  delete: async (
    scopeId: string | undefined,
    attachmentId: string,
    annotationId: string,
    expectedVersion?: number,
  ): Promise<boolean> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/${encodeURIComponent(annotationId)}`,
      scopeId,
    );
    const res = await libraryClient.delete<{ success?: boolean } | boolean>(url, {
      params: expectedVersion !== undefined ? { expectedVersion } : undefined,
    });
    return typeof res === 'boolean' ? res : Boolean(res?.success);
  },

  batch: async (
    scopeId: string | undefined,
    attachmentId: string,
    payload: { upserts: unknown[]; deletes: string[] },
  ): Promise<unknown> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/batch`,
      scopeId,
    );
    return libraryClient.put<unknown>(url, payload);
  },

  extractNotes: async (
    scopeId: string | undefined,
    itemId: string,
  ): Promise<{ totalExtracted: number; note?: unknown }> => {
    try {
      const res = await NotesService.extractNotes(scopeId, itemId);
      return { totalExtracted: 1, note: res };
    } catch {
      return { totalExtracted: 0 };
    }
  },

  importExternal: async (
    scopeId: string | undefined,
    attachmentId: string,
  ): Promise<{ importedCount: number }> => {
    const url = resolveLibraryUrl(
      'reader',
      `/attachments/${encodeURIComponent(attachmentId)}/annotations/import-external`,
      scopeId,
    );
    return libraryClient.post<{ importedCount: number }>(url, {});
  },
};

const ReaderStateService = {
  getState: async (scopeId: string | undefined, itemId: string): Promise<DocumentReadingState | null> => {
    try {
      const state = await StateService.getState(scopeId, itemId);
      return (state as DocumentReadingState | null) ?? null;
    } catch {
      return null;
    }
  },

  updateState: async (
    scopeId: string | undefined,
    itemId: string,
    patch: Partial<DocumentReadingState>,
  ): Promise<DocumentReadingState> => {
    const updated = await StateService.updateState(scopeId, itemId, patch);
    return updated as DocumentReadingState;
  },

  markAsRead: (scopeId: string | undefined, itemId: string) =>
    StateService.markAsRead(scopeId, itemId),
};

const ReaderAttachmentsService = {
  reExtract: AttachmentsService.reExtract,
};

const ReaderCitationsService = {
  exportLibrary: ExportsService.exportLibrary,
  downloadAnnotatedPdf: ExportsService.downloadAnnotatedPdf,
};

export const readerService = {
  getDocument: ReaderDocumentsService.get,
  getAnnotations: ReaderAnnotationsService.getByAttachment,
  createAnnotation: ReaderAnnotationsService.create,
  updateAnnotation: ReaderAnnotationsService.update,
  deleteAnnotation: ReaderAnnotationsService.delete,
  batchAnnotations: ReaderAnnotationsService.batch,
  getState: ReaderStateService.getState,
  updateState: ReaderStateService.updateState,
  markAsRead: ReaderStateService.markAsRead,
  documents: ReaderDocumentsService,
  items: ReaderDocumentsService,
  annotations: ReaderAnnotationsService,
  state: ReaderStateService,
  attachments: ReaderAttachmentsService,
  citations: ReaderCitationsService,
  exports: ReaderCitationsService,
  fetchPdfBlob,
  getItemFileUrl,
  isProjectScope,
};

export const ItemService = ItemsService;
export const QualityService = CurationService;
export const fetchReferenceByDoi = CitationService.resolveDoi;

export const FeedsService = {
  getSubscriptions: () =>
    libraryClient.get<{ data: Array<{
      id: string;
      userId: string;
      feedId: string;
      customTitle: string | null;
      cleanupReadAfter: number;
      cleanupUnreadAfter: number;
      feed: {
        id: string;
        url: string;
        title: string;
        siteUrl: string | null;
        description: string | null;
        lastFetchedAt: string | null;
      };
    }> }>(resolveLibraryUrl('ingestion', '/feeds/subscriptions')),

  subscribe: (data: { url: string; customTitle?: string; cleanupDays?: number }) =>
    libraryClient.post<{ data: unknown }>(resolveLibraryUrl('ingestion', '/feeds/subscriptions'), data),

  updateSubscription: (feedId: string, data: { customTitle?: string; cleanupDays?: number }) =>
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

export const libraryServices = {
  items: ItemsService,
  collections: CollectionsService,
  tags: TagsService,
  notes: NotesService,
  state: StateService,
  savedSearches: SavedSearchesService,
  relations: RelationsService,
  citations: CitationService,
  exports: ExportsService,
  attachments: AttachmentsService,
  upload: UploadService,
  ingestion: IngestionService,
  curation: CurationService,
  retraction: RetractionService,
  search: SearchService,
  sync: SyncService,
  feeds: FeedsService,
  reader: readerService,
};

export default libraryServices;
