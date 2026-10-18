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
import { mapBackendItemToPaper, mapBackendPaperToItem } from '@/features/library/domain/metadata';
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
  AttachmentDto,
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

export { isProjectScope, getItemFileUrl, mapBackendItemToPaper, mapBackendPaperToItem };
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

// Base URL & Per-Domain Endpoints

export function getLibraryServiceHost(domain?: LibrarySubdomain): string {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    try {
      const override = window.localStorage.getItem('FLUX_LIBRARY_SERVICE_URL');
      if (override && override.trim()) {
        return normalizeServiceHost(override.trim());
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const domainEnvMap: Record<LibrarySubdomain, string | undefined> = {
    catalog: process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL,
    extraction: process.env.NEXT_PUBLIC_LIBRARY_EXTRACTION_URL,
    ingestion: process.env.NEXT_PUBLIC_LIBRARY_INGESTION_URL,
    citation: process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL,
    search: process.env.NEXT_PUBLIC_LIBRARY_SEARCH_URL,
    sync: process.env.NEXT_PUBLIC_LIBRARY_SYNC_URL,
    reader: process.env.NEXT_PUBLIC_LIBRARY_READER_URL,
  };

  const rawConfigured =
    (domain ? domainEnvMap[domain] : undefined) ||
    process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL ||
    process.env.NEXT_PUBLIC_LIBRARY_SERVICE_URL ||
    process.env.NEXT_PUBLIC_LIBRARIES_SERVICE_URL ||
    '';

  return normalizeServiceHost(rawConfigured);
}

function normalizeServiceHost(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '/api/v1/library' || trimmed === '/api/v1' || trimmed === '/') {
    return '';
  }
  return trimmed
    .replace(/\/api\/v1\/library$/i, '')
    .replace(/\/api\/v1$/i, '');
}

export function resolveLibraryUrl(
  domain: LibrarySubdomain,
  resourcePath: string,
  scopeId?: string,
  suffix = '',
): string {
  const host = getLibraryServiceHost(domain);
  const cleanResource = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  const cleanSuffix = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '';

  const basePath = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library${cleanResource}${cleanSuffix}`
    : `/api/v1/library${cleanResource}${cleanSuffix}`;

  return host ? `${host}${basePath}` : basePath;
}

export function resolveLibraryRawPath(path: string, domain?: LibrarySubdomain): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const host = getLibraryServiceHost(domain);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return host ? `${host}${cleanPath}` : cleanPath;
}

function withLibraryServiceOptions(
  url: string,
  options?: RequestOptions,
  scopeId?: string,
): RequestOptions | undefined {
  const isExternalMicroserviceUrl = url.startsWith('http://') || url.startsWith('https://');
  if (!isExternalMicroserviceUrl) {
    return options;
  }

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
  // If cleanSuffix starts with /items, /citations, /convert-type, /tags, etc.
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

export const fetchPdfBlob = async (url: string, signal?: AbortSignal): Promise<Blob> => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid document URL provided.');
  }

  const targetUrl = url.trim();
  const isLocalStatic = targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');
  const libraryHost = getLibraryServiceHost('extraction') || getLibraryServiceHost('catalog');
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
  return blob;
};

function toIngestionSubmission(payload: UnifiedIngestionPayload): Record<string, unknown> {
  const p = payload as Record<string, unknown>;
  const source = p.source as string;
  const base = {
    source,
    collectionId: p.collectionId,
    allowDuplicates: p.allowDuplicates,
  };
  if (source === 'doi') return { ...base, doi: p.doi };
  if (source === 'arxiv') return { ...base, arxivId: p.arxivId };
  if (source === 'isbn') return { ...base, isbn: p.isbn };
  if (source === 'pmid') return { ...base, pmid: p.pmid };
  if (source === 'bibtex' || source === 'ris') return { ...base, content: p.content };
  if (source === 'pdf') {
    return {
      ...base,
      fileId: p.fileId,
      filename: p.filename,
      autoExtract: p.autoExtract,
      enableOcr: p.enableOcr,
    };
  }
  if (source === 'manual') return { ...base, item: p.item };
  return base;
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

function unwrapItemResponse(res: unknown): Item & { item: Item; paper: Item } {
  const obj = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const rawItem = ((obj.item || obj.paper || obj.data || res) ?? {}) as Item;
  const item = mapBackendItemToPaper(rawItem);
  return { ...item, item, paper: item };
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

// CANONICAL UNIFIED LIBRARY CLIENT SDK

export const libraryServices = {
  // 1. Items & Catalog Operations
  items: {
    list: (scopeId?: string, params?: ItemQueryParams) => ItemsService.getAll(scopeId, params),
    getAll: (scopeId?: string, params?: ItemQueryParams) => ItemsService.getAll(scopeId, params),
    getItem: (scopeId: string | undefined, itemId: string) => ItemsService.getItem(scopeId, itemId),
    getById: (scopeId: string | undefined, itemId: string) => ItemsService.getItem(scopeId, itemId),
    create: (scopeId: string | undefined, collectionId: string, itemData: Record<string, unknown>) =>
      ItemsService.create(scopeId || 'user', collectionId, itemData as Partial<Item>),
    update: (scopeId: string | undefined, itemId: string, itemData: Record<string, unknown>) =>
      ItemsService.update(scopeId || 'user', itemId, itemData as Partial<Item>),
    delete: (scopeId: string | undefined, itemId: string) =>
      ItemsService.delete(scopeId || 'user', itemId),
    purge: (scopeId: string | undefined, itemId: string) =>
      ItemsService.purge(scopeId || 'user', itemId),
    restore: (scopeId: string | undefined, itemId: string) =>
      ItemsService.restore(scopeId || 'user', itemId),
    bulkDelete: (scopeId: string | undefined, itemIds: string[]) =>
      ItemsService.bulkTrash(scopeId || 'user', itemIds),
    bulkPurge: (scopeId: string | undefined, itemIds: string[]) =>
      ItemsService.bulkPurge(scopeId || 'user', itemIds),
    bulkRestore: (scopeId: string | undefined, itemIds: string[]) =>
      ItemsService.bulkRestore(scopeId || 'user', itemIds),
    getCounts: (scopeId?: string) => ItemsService.getCounts(scopeId),
    importFromUser: (projectId: string, itemIds: string[]) =>
      ItemsService.importFromUser(projectId, itemIds),
    importFromPersonal: (projectId: string, itemIds: string[]) =>
      ItemsService.importFromPersonal(projectId, itemIds),
    fetchPdfBlob,
    getFulltext: (scopeId: string | undefined, itemId: string) =>
      ItemsService.getFulltext(scopeId, itemId) as Promise<DocumentFulltext | null>,
    reindexItem: (scopeId: string | undefined, itemId: string) =>
      ItemsService.reindexItem(scopeId, itemId),
    getMetadataSources: (scopeId: string | undefined, itemId: string) =>
      ItemsService.getMetadataSources(scopeId, itemId),
    getByCollection: (scopeId: string | undefined, collectionId: string, search?: string) =>
      ItemsService.getByCollection(scopeId || 'user', collectionId, search),
  },

  // 2. Collections Operations
  collections: {
    list: (scopeId?: string) => CollectionsService.getAll(scopeId),
    getAll: (scopeId?: string) => CollectionsService.getAll(scopeId),
    get: (scopeId: string | undefined, collectionId: string) =>
      CollectionsService.getById(scopeId, collectionId),
    getById: (scopeId: string | undefined, collectionId: string) =>
      CollectionsService.getById(scopeId, collectionId),
    create: (scopeId: string | undefined, data: CreateCollectionDTO) =>
      CollectionsService.create(scopeId, data),
    update: (scopeId: string | undefined, collectionId: string, data: UpdateCollectionDTO) =>
      CollectionsService.update(scopeId, collectionId, data),
    delete: (scopeId: string | undefined, collectionId: string) =>
      CollectionsService.delete(scopeId, collectionId),
    moveItems: (scopeId: string | undefined, targetCollectionId: string, itemIds: string[]) =>
      CollectionsService.moveItems(scopeId, targetCollectionId, itemIds),
    detachItems: (scopeId: string | undefined, collectionId: string, itemIds: string[]) =>
      CollectionsService.bulkDetachItems(scopeId, collectionId, itemIds),
    exportBibtex: (scopeId: string | undefined, collectionId: string) =>
      CollectionsService.exportBibtex(scopeId, collectionId),
    exportBundle: (scopeId: string | undefined, collectionId: string) =>
      CollectionsService.exportBundle(scopeId, collectionId),
  },

  // 3. Tags & Notes Operations
  tags: {
    list: (scopeId?: string) => TagsService.list(scopeId),
    attachToItem: (scopeId: string | undefined, itemId: string, tagName: string, color?: string) =>
      libraryClient.post<TagWithCount>(
        resolveLibraryUrl('catalog', `/items/${encodeURIComponent(itemId)}/tags`, scopeId),
        { name: tagName, color },
      ),
    detachFromItem: (scopeId: string | undefined, itemId: string, tagId: string) =>
      TagsService.removeFromItem(scopeId, tagId, itemId),
    rename: (scopeId: string | undefined, tagId: string, name: string) =>
      TagsService.update(scopeId, tagId, { name }),
    delete: (scopeId: string | undefined, tagId: string) =>
      TagsService.delete(scopeId, tagId),
  },

  notes: {
    getByItem: (scopeId: string | undefined, itemId: string) =>
      NotesService.list(scopeId, itemId),
    create: (scopeId: string | undefined, itemId: string, content: string, title?: string) =>
      NotesService.create(scopeId, { itemId, contentMd: content, title }),
    update: (scopeId: string | undefined, noteId: string, content: string, title?: string) =>
      NotesService.update(scopeId, noteId, undefined, { contentMd: content, title }),
    delete: (scopeId: string | undefined, noteId: string) =>
      NotesService.delete(scopeId, noteId),
  },

  // 4. Saved Searches Operations
  savedSearches: {
    list: (scopeId?: string) => SavedSearchesService.getAll(scopeId),
    create: (scopeId: string | undefined, input: CreateSavedSearchInput) =>
      SavedSearchesService.create(scopeId, input),
    update: (scopeId: string | undefined, id: string, input: UpdateSavedSearchInput) =>
      SavedSearchesService.update(scopeId, id, input),
    delete: (scopeId: string | undefined, id: string) =>
      SavedSearchesService.delete(scopeId, id),
    preview: (scopeId: string | undefined, conditions: SavedSearchConditionGroup) =>
      SavedSearchesService.preview(scopeId, conditions),
    execute: (scopeId: string | undefined, id: string, params?: { page?: number; limit?: number }) =>
      SavedSearchesService.getResults(scopeId, id, params),
  },

  // 5. Relations Operations
  relations: {
    list: (scopeId: string | undefined, itemId: string) =>
      RelationsService.getRelated(scopeId, itemId).then((r) => r.relatedItems),
    link: (scopeId: string | undefined, itemId: string, targetItemId: string) =>
      RelationsService.link(scopeId, itemId, targetItemId),
    unlink: (scopeId: string | undefined, itemId: string, targetItemId: string) =>
      RelationsService.unlink(scopeId, itemId, targetItemId),
  },

  // 6. Citations & Bibliography Operations
  citations: {
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
        citations: Array<{ paperId: string; itemId?: string; citation: FormattedCitation }>;
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
      const results = await libraryServices.citations.search(trimmed, scopeId);
      return results.length > 0 ? results[0] : null;
    },
  },

  exports: {
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
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: res.mimeType || 'application/pdf' });
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
          URL.revokeObjectURL(url);
        }
      }
      return { filename: resolvedFilename, mimeType: 'application/pdf' };
    },
  },

  // 7. Extraction, Attachments & Upload Operations
  attachments: {
    list: async (scopeId: string, itemId: string): Promise<AttachmentDto[]> => {
      const res = await libraryClient.get<{ attachments: AttachmentDto[] }>(getItemAttachmentUrl(scopeId, itemId));
      return res.attachments || [];
    },
    get: async (scopeId: string, attachmentId: string): Promise<AttachmentDto> => {
      const res = await libraryClient.get<{ attachment?: AttachmentDto } | AttachmentDto>(getAttachmentUrl(scopeId, attachmentId));
      if (res && typeof res === 'object' && 'attachment' in res && res.attachment) {
        return res.attachment;
      }
      return res as AttachmentDto;
    },
    delete: async (scopeId: string, attachmentId: string): Promise<boolean> => {
      const res = await libraryClient.delete<{ success: boolean }>(getAttachmentUrl(scopeId, attachmentId));
      return res.success;
    },
    create: async (scopeId: string, itemId: string, data: Record<string, unknown>): Promise<AttachmentDto> => {
      const res = await libraryClient.post<{ attachment?: AttachmentDto } | AttachmentDto>(
        getItemAttachmentUrl(scopeId, itemId),
        data,
      );
      return (res as { attachment?: AttachmentDto }).attachment ?? (res as AttachmentDto);
    },
    captureSnapshot: async (scopeId: string, itemId: string, url?: string): Promise<AttachmentDto> => {
      const res = await libraryClient.post<{ attachment?: AttachmentDto } | AttachmentDto>(
        getItemAttachmentUrl(scopeId, itemId, 'snapshot'),
        url ? { url } : {},
      );
      return (res as { attachment?: AttachmentDto }).attachment ?? (res as AttachmentDto);
    },
    rename: async (scopeId: string, attachmentId: string, dto: { filename?: string; pattern?: string }) => {
      return libraryClient.patch<{ attachment: AttachmentDto; oldFilename: string; newFilename: string }>(
        getAttachmentUrl(scopeId, attachmentId, 'rename'),
        dto,
      );
    },
    batchRename: async (scopeId: string, dto: { itemIds?: string[]; attachmentIds?: string[]; pattern?: string }) =>
      libraryClient.post<{
        renamedCount: number;
        results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
      }>(resolveLibraryUrl('extraction', '/attachments/batch-rename', scopeId), dto),
    reExtract: async (scopeId: string | undefined, attachmentId: string) => {
      return libraryClient.post<{ status: string; attachmentId: string; message: string }>(
        getAttachmentUrl(scopeId, attachmentId, 're-extract'),
        {},
      );
    },
    setPrimary: (scopeId: string, itemId: string, attachmentId: string) =>
      libraryClient.post<{ success: boolean }>(
        getItemAttachmentUrl(scopeId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
        {},
      ),
  },

  upload: {
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
        headers: { 'Content-Type': 'multipart/form-data' },
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
  },

  // 8. Ingestion & Curation Operations
  ingestion: {
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
  },

  curation: {
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
          totalDuplicates: res.duplicates.reduce((acc, g) => acc + (g.papers?.length || 0), 0),
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
        const parsedPapers = (c.items || []).map((it) => {
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
          return itemSchema.parse({
            ...it,
            id: it.id,
            title: it.title,
            itemType: it.itemType || 'journalArticle',
            doi: it.doi || '',
            authors: it.authors || [],
            year: it.year || null,
            citationKey: it.citationKey || '',
            collectionId: it.collectionId || null,
            ...(rawTags ? { tags: rawTags } : {}),
          });
        });
        return {
          matchType: c.matchReason === 'EXACT_DOI' ? 'DOI' : 'TITLE_AUTHOR_YEAR',
          confidence: c.confidence >= 1 ? 'high' : 'medium',
          key: c.clusterId,
          ...(c.recommendedMasterId ? { recommendedMasterId: c.recommendedMasterId } : {}),
          papers: parsedPapers,
          items: parsedPapers,
        };
      });

      return {
        duplicateGroups,
        totalDuplicates: duplicateGroups.reduce(
          (acc, g) => acc + (g.papers?.length || 0),
          0,
        ),
      };
    },
    mergeDuplicates: (scopeId: string | undefined, masterId: string, duplicateIds: string[], overrides?: Record<string, unknown>) =>
      libraryClient.post<{ success: boolean; masterItem: Item }>(getCurationUrl(scopeId, 'merge'), {
        masterId,
        duplicateIds,
        overrides,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      }),
    mergePapers: async (
      scopeId: string | undefined,
      masterPaperId: string,
      sourcePaperIds: string[],
      fieldSelections?: Record<string, unknown>,
    ) => {
      interface MergeApiResponse {
        primaryItem?: unknown;
        masterPaper?: unknown;
        mergedCount?: number;
        softDeletedItemIds?: string[];
        softDeletedPaperIds?: string[];
        data?: {
          masterPaper?: unknown;
          mergedCount?: number;
          softDeletedPaperIds?: string[];
        };
      }
      const res = await libraryClient.post<MergeApiResponse>(
        getCurationUrl(scopeId, 'merge'),
        {
          primaryItemId: masterPaperId,
          duplicateItemIds: sourcePaperIds,
          fieldSelections,
        },
      );
      const masterPaper = res?.primaryItem || res?.masterPaper || res?.data?.masterPaper;
      const mergedCount = res?.mergedCount ?? res?.data?.mergedCount ?? sourcePaperIds.length;
      const softDeletedPaperIds =
        res?.softDeletedItemIds ||
        res?.softDeletedPaperIds ||
        res?.data?.softDeletedPaperIds ||
        [];
      return {
        success: true,
        data: { masterPaper, mergedCount, softDeletedPaperIds },
        masterPaper,
        primaryItem: masterPaper,
      };
    },
    getIntegrityReport: async (scopeId?: string): Promise<LibraryIntegrityReport> => {
      const pQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
      return libraryClient.get<LibraryIntegrityReport>(`${getCurationUrl(scopeId, 'integrity')}${pQuery}`);
    },
    dismissDuplicate: (scopeId: string | undefined, itemAId: string, itemBId: string) =>
      libraryClient.post<{ success: boolean }>(getCurationUrl(scopeId, 'dismiss-duplicate'), {
        itemAId,
        itemBId,
      }),
    dismissDuplicates: (scopeId: string | undefined, itemIds: string[]) =>
      libraryClient.post<{ dismissed: boolean; itemIds: string[] }>(
        getCurationUrl(scopeId, 'duplicates/dismiss'),
        { itemIds },
      ),
  },

  retraction: {
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
  },

  // 9. Search & Sync Operations
  search: {
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
  },

  sync: {
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
  },

  // 10. PDF Reader & Annotations Operations
  reader: {
    getDocument: async (scopeId: string | undefined, itemId: string): Promise<ReaderDocument> => {
      const item = await ItemsService.getItem(scopeId, itemId);
      return item as ReaderDocument;
    },
    getAnnotations: async (scopeId: string | undefined, attachmentId: string): Promise<ReaderAnnotation[]> => {
      if (!attachmentId) return [];
      const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
      const res = await libraryClient.get<ReaderAnnotation[] | { data?: ReaderAnnotation[]; annotations?: ReaderAnnotation[] }>(url);
      return unwrapList<ReaderAnnotation>(res, 'annotations');
    },
    createAnnotation: async (scopeId: string | undefined, attachmentId: string, dto: CreateAnnotationDto): Promise<ReaderAnnotation> => {
      const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/annotations`, scopeId);
      return libraryClient.post<ReaderAnnotation>(url, dto);
    },
    updateAnnotation: async (
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
    deleteAnnotation: async (
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
    batchAnnotations: async (
      scopeId: string | undefined,
      attachmentId: string,
      payload: { upserts: unknown[]; deletes: string[] },
    ): Promise<unknown> => {
      const url = resolveLibraryUrl(
        'reader',
        `/attachments/${encodeURIComponent(attachmentId)}/annotations/batch`,
        scopeId,
      );
      return libraryClient.post<unknown>(url, payload);
    },
    getState: async (scopeId: string | undefined, paperId: string): Promise<DocumentReadingState | null> => {
      const state = await StateService.getState(scopeId, paperId);
      return (state as DocumentReadingState | null) ?? null;
    },
    updateState: async (
      scopeId: string | undefined,
      paperId: string,
      patch: Partial<DocumentReadingState>,
    ): Promise<DocumentReadingState> => {
      const updated = await StateService.updateState(scopeId, paperId, patch);
      return updated as DocumentReadingState;
    },
    markAsRead: async (scopeId: string | undefined, paperId: string): Promise<{ success: boolean }> => {
      await StateService.markAsRead(scopeId, paperId);
      return { success: true };
    },
  },
};

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

  importFromPersonal: (projectId: string, itemIds: string[]) =>
    ItemsService.importFromUser(projectId, itemIds),

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
              (Array.isArray(params.tags) ? params.tags.join(',') : (params.tags as string | undefined)),
          tags: Array.isArray(params.tags)
            ? params.tags.join(',')
            : (params.tags as string | undefined),
        }
      : undefined;
    return libraryClient.get<PaginatedItemsResponse>(
      getCatalogUrl(scopeId),
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
    libraryClient.get<Item | { item?: Item; paper?: Item }>(
      getCatalogUrl(scopeId, encodeURIComponent(itemId)),
    ).then(unwrapItemResponse),

  getMetadataSources: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<ItemMetadataSourcesResponse>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/metadata-sources`),
    ),

  getByCollection: (scopeId: string, collectionId: string, search?: string) =>
    libraryClient.get<Record<string, unknown> | Item[]>(
      getCatalogUrl(scopeId),
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
    return libraryClient.post<Record<string, unknown>>(
      getCatalogUrl(scopeId),
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
    const res = await libraryClient.patch<Record<string, unknown>>(
      getCatalogUrl(scopeId, encodeURIComponent(itemId)),
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
    const res = await libraryClient.put<Record<string, unknown>>(
      getCatalogUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    return unwrapItemResponse(res);
  },

  delete: (scopeId: string, itemId: string) =>
    libraryClient.delete(
      getCatalogUrl(scopeId, encodeURIComponent(itemId)),
    ),

  restore: (scopeId: string, itemId: string, expectedVersion?: number) => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    return libraryClient.post<Record<string, unknown>>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/restore${versionQuery}`),
      {},
    ).then((res) => {
      const { item } = unwrapItemResponse(res);
      return { success: true, data: item, item, paper: item };
    });
  },

  purge: (scopeId: string, itemId: string) =>
    libraryClient.delete<{ success: boolean; data: { purged: boolean } }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/purge`),
    ),

  bulkPurge: (scopeId: string, itemIds: string[]) =>
    libraryClient.post<{ success: boolean; count: number; purgedIds: string[] }>(
      getCatalogUrl(scopeId, 'bulk-purge'),
      { itemIds },
    ),

  bulkTrash: (scopeId: string, itemIds: string[]) =>
    libraryClient.post<{ success: boolean; count: number; trashedIds: string[] }>(
      getCatalogUrl(scopeId, 'bulk-trash'),
      { itemIds },
    ),

  bulkRestore: (scopeId: string, itemIds: string[]) =>
    libraryClient.post<{ success: boolean; count: number; restoredIds: string[] }>(
      getCatalogUrl(scopeId, 'bulk-restore'),
      { itemIds },
    ),

  reindex: (scopeId: string, itemId: string) =>
    libraryClient.post<{ message: string; itemId: string }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
    ),

  getItemTypes: (_scopeId?: string) =>
    libraryClient.get<Record<string, unknown>>(
      `/api/v1/library/item-types`,
      { rawEnvelope: true },
    ),

  getItemType: (_scopeId: string, itemType: string) =>
    libraryClient.get<{ success: boolean; itemType: unknown; data: unknown }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
    ),

  previewConvertType: (
    scopeId: string,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra: boolean = true,
  ) =>
    libraryClient.post<{ success: boolean; preview: unknown; data: unknown }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type/preview`),
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
    libraryClient.post<{ success: boolean; paper: Item; item: Item; conversionReport: unknown }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type`),
      { targetType, expectedVersion, retainUnmappedInExtra },
    ),

  reindexItem: (scopeId: string | undefined, itemId: string) =>
    libraryClient.post<{ success: boolean; data?: unknown }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
      {},
    ).then((res) => res?.data || res || { success: true }),

  getFulltext: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<Record<string, unknown>>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/fulltext`),
    ).then((res) => (res as { data?: unknown })?.data || res || null).catch(() => null),

  getItemFileUrl,

  getItem: (scopeId: string | undefined, itemId: string) =>
    ItemsService.getById(scopeId || 'user', itemId),

  updateItem: (scopeId: string | undefined, itemId: string, data: Partial<Item>) =>
    ItemsService.update(scopeId || 'user', itemId, data),

  fetchPdfBlob,

  markMyPublication: (scopeId: string, itemId: string) =>
    ItemsService.setMyPublication(scopeId, itemId, true),

  unmarkMyPublication: (scopeId: string, itemId: string) =>
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

  setMyPublication: (scopeId: string, itemId: string, isMyPublication: boolean) =>
    isMyPublication
      ? libraryClient.post<{ success: boolean; data: Item; item: Item }>(
          getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/my-publication`),
          {},
        ).then((res) => res?.item || res?.data || res)
      : libraryClient.delete<{ success: boolean; data: Item; item: Item }>(
          getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/my-publication`),
        ).then((res) => res?.item || res?.data || res),
};

export const ItemService = ItemsService;

// 2. CollectionsService
export const CollectionsService = {
  getAll: (scopeId?: string) =>
    libraryClient.get<{ collections: Collection[] }>(
      resolveLibraryUrl('catalog', '/collections', scopeId),
    ),

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

  movePapers: (scopeId: string | undefined, collectionId: string, paperIds: string[]) =>
    CollectionsService.moveItems(scopeId, collectionId, paperIds),

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

  getItemCollections: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<{ success?: boolean; collections: Collection[] }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/collections`),
    ).then((res) => res?.collections || (Array.isArray(res) ? res : [])),

  exportBibtex: (scopeId: string | undefined, collectionId: string) => {
    const projectQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return libraryClient.get<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId)}${projectQuery}`,
    );
  },

  exportBundle: (_scopeId: string | undefined, collectionId: string) =>
    libraryClient.get<{
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

// 3. TagsService
function getTagsUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/tags', scopeId, suffix);
}

export const TagsService = {
  list: async (scopeId?: string): Promise<TagWithCount[]> => {
    const raw = await libraryClient.get<TagWithCount[] | { data: TagWithCount[] }>(getTagsUrl(scopeId));
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
    const raw = await libraryClient.post<TagWithCount | { data: TagWithCount }>(
      getTagsUrl(scopeId),
      {
        name,
        color,
        type,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
    return (raw && 'data' in raw && raw.data ? raw.data : raw) as TagWithCount;
  },

  update: async (
    scopeId: string | undefined,
    tagId: string,
    data: { name?: string; color?: string; type?: string },
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.patch<TagWithCount | { data: TagWithCount }>(
      getTagsUrl(scopeId, encodeURIComponent(tagId)),
      data,
    );
    return (raw && 'data' in raw && raw.data ? raw.data : raw) as TagWithCount;
  },

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

  removeFromItem: async (
    scopeId: string | undefined,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await libraryClient.delete<unknown>(
      getTagsUrl(scopeId, `${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`),
    );
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
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/state/read`),
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

// 6. ItemTypesService
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

// 7. SavedSearchesService
export const SavedSearchesService = {
  getAll: (scopeId?: string) =>
    libraryClient.get<SavedSearch[]>(
      resolveLibraryUrl('catalog', '/saved-searches', scopeId),
    ),

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
      cursor?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) =>
    libraryClient.get<SavedSearchResultsResponse>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}/results`, scopeId),
      params ? { params } : undefined,
    ),
};

// 8. RelationsService
export const RelationsService = {
  getRelated: (scopeId: string | undefined, itemId: string) =>
    libraryClient.get<{ relatedItems?: RelatedItem[]; relatedPapers?: RelatedItem[]; total?: number }>(
      getCatalogUrl(scopeId, `${encodeURIComponent(itemId)}/relations`),
    ).then((res) => {
      const items = res?.relatedItems ?? res?.relatedPapers ?? [];
      return {
        relatedItems: items,
        total: res?.total ?? items.length,
      };
    }),

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

// 9. Upload & Attachment Helpers
export const UploadService = libraryServices.upload;

// 10. Citation & Export Domain Services
export const CitationService = {
  ...libraryServices.citations,
  fetchByDoi: libraryServices.citations.resolveDoi,
};

export const fetchReferenceByDoi = libraryServices.citations.resolveDoi;
export const exportAnnotatedPdf = libraryServices.exports.exportAnnotatedPdf;
export const downloadAnnotatedPdf = libraryServices.exports.downloadAnnotatedPdf;
export const exportLibrary = libraryServices.exports.exportLibrary;

// 11. Ingestion, Curation & Sync Services
export const IngestionService = libraryServices.ingestion;
export const QualityService = libraryServices.curation;
export const SyncService = libraryServices.sync;

// 12. Reader Services

const ReaderDocumentsService = {
  get: libraryServices.reader.getDocument,

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

  reindex: ItemsService.reindexItem,

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
  getByAttachment: libraryServices.reader.getAnnotations,
  create: libraryServices.reader.createAnnotation,
  update: libraryServices.reader.updateAnnotation,
  delete: libraryServices.reader.deleteAnnotation,
  batch: libraryServices.reader.batchAnnotations,

  extractNotes: async (
    scopeId: string | undefined,
    paperId: string,
  ): Promise<{ totalExtracted: number; note?: unknown }> => {
    try {
      const res = await NotesService.extractNotes(scopeId, paperId);
      return { totalExtracted: 1, note: res };
    } catch {
      return { totalExtracted: 0 };
    }
  },

  importExternal: async (
    scopeId: string | undefined,
    attachmentId: string,
  ): Promise<{ importedCount: number }> => {
    const url = resolveLibraryUrl('reader', `/attachments/${encodeURIComponent(attachmentId)}/import-annotations`, scopeId);
    return libraryClient.post<{ importedCount: number }>(url, {}).catch(() => ({ importedCount: 0 }));
  },
};

const ReaderStateService = {
  getState: async (scopeId: string | undefined, itemId: string): Promise<DocumentReadingState | null> => {
    try {
      return await libraryServices.reader.getState(scopeId, itemId);
    } catch {
      return null;
    }
  },
  updateState: libraryServices.reader.updateState,
  markAsRead: (scopeId: string | undefined, itemId: string) =>
    StateService.markAsRead(scopeId, itemId),
};

const ReaderAttachmentsService = {
  reExtract: libraryServices.attachments.reExtract,
};

const ReaderCitationsService = {
  exportLibrary: libraryServices.exports.exportLibrary,
  downloadAnnotatedPdf: libraryServices.exports.downloadAnnotatedPdf,
};

export const readerService = {
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

export default libraryServices;
