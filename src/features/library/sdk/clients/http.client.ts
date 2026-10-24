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

  const hasExtraHeaders = Object.keys(extraHeaders).length > 0;
  if (!options && !hasExtraHeaders) {
    return undefined;
  }

  return {
    ...options,
    ...(hasExtraHeaders ? { headers: extraHeaders } : {}),
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

export function getCatalogUrl(scopeId?: string, suffix = ''): string {
  if (!suffix) {
    return resolveLibraryUrl('catalog', '/items', scopeId);
  }
  const cleanSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  const resourcePath = cleanSuffix.startsWith('/items') ? cleanSuffix : `/items${cleanSuffix}`;
  return resolveLibraryUrl('catalog', resourcePath, scopeId);
}

export function getCitationUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('citation', '/citation', scopeId, suffix);
}

export function getExportsUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('citation', '/exports', scopeId, suffix);
}

export function getIngestionUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('ingestion', '/ingestion', scopeId, suffix);
}

export function getCurationUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('ingestion', '/curation', scopeId, suffix);
}

export function getRetractionUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('ingestion', '/retraction', scopeId, suffix);
}

export function getSyncUrl(scopeId?: string, suffix = ''): string {
  return resolveLibraryUrl('sync', '/sync', scopeId, suffix);
}

export function getItemAttachmentUrl(scopeId: string | undefined, itemId: string, suffix = ''): string {
  return resolveLibraryUrl(
    'extraction',
    `/items/${encodeURIComponent(itemId)}/attachments`,
    scopeId,
    suffix,
  );
}

export function getAttachmentUrl(scopeId: string | undefined, attachmentId: string, suffix = ''): string {
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
    let normalizedTarget = targetUrl.trim();
    // Special handling for arXiv URLs: /pdf/<id>.pdf redirects to /pdf/<id> which causes CORS in browsers
    if (normalizedTarget.includes('arxiv.org/pdf/') && normalizedTarget.endsWith('.pdf')) {
      normalizedTarget = normalizedTarget.replace(/\.pdf$/i, '');
    } else if (normalizedTarget.includes('arxiv.org/abs/')) {
      normalizedTarget = normalizedTarget.replace('arxiv.org/abs/', 'arxiv.org/pdf/');
    }

    const isLocalStatic = normalizedTarget.startsWith('/papers/') || normalizedTarget.startsWith('/public/');
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

    let resolvedUrl = normalizedTarget;
    let isTrustedOrigin = false;
    try {
      if (normalizedTarget.startsWith('http://') || normalizedTarget.startsWith('https://')) {
        resolvedUrl = normalizedTarget;
      } else if (isLocalStatic) {
        resolvedUrl = normalizedTarget;
      } else if (rawApiBase) {
        const cleanBase = rawApiBase.replace(/\/+$/, '');
        const cleanPath = normalizedTarget.replace(/^\/+/, '');
        resolvedUrl = `${cleanBase}/${cleanPath}`;
      } else {
        resolvedUrl = normalizedTarget;
      }

      if (baseUrl) {
        const resolvedOrigin = new URL(resolvedUrl, baseUrl).origin;
        const apiOrigin = rawApiBase ? new URL(rawApiBase, baseUrl).origin : new URL(baseUrl).origin;
        const libOrigin = libraryHost ? new URL(libraryHost, baseUrl).origin : apiOrigin;
        isTrustedOrigin =
          resolvedOrigin === new URL(baseUrl).origin ||
          resolvedOrigin === apiOrigin ||
          resolvedOrigin === libOrigin ||
          normalizedTarget.startsWith('/api/');
      } else {
        isTrustedOrigin = normalizedTarget.startsWith('/api/');
      }
    } catch {
      isTrustedOrigin = normalizedTarget.startsWith('/api/');
    }

    const headers: Record<string, string> = {};
    const token = api.getAuthToken();
    if (token && isTrustedOrigin && !isLocalStatic) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(resolvedUrl, {
        credentials: isTrustedOrigin && !isLocalStatic ? 'include' : 'same-origin',
        headers,
      });
    } catch (networkErr: unknown) {
      const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        throw new Error(
          `Unable to load PDF from external source due to browser security (CORS) or network error: ${msg}. You can open the original document directly in a new tab.`
        );
      }
      throw new Error(`Network error while downloading PDF: ${msg}`);
    }

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

export function toIngestionSubmission(payload: UnifiedIngestionPayload): Record<string, unknown> {
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

export function unwrapList<T>(res: unknown, key: string): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export function unwrapRecord<T>(res: unknown, key: string): T | null {
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

export function unwrapItemResponse(res: unknown): Item {
  const obj = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const rawItem = ((obj.item || obj.data || res) ?? {}) as Item;
  return mapBackendItem(rawItem);
}

export function unwrapResolvedReference(raw: unknown): ReferenceData | null {
  if (!raw || typeof raw !== 'object') return null;
  const res = raw as Record<string, unknown>;
  if (res.found === false) return null;
  const candidate = (res.metadata || res.work || res.data || res) as Partial<ReferenceData> | undefined;
  if (candidate && typeof candidate === 'object') {
    return { ...candidate, title: candidate.title || '' } as ReferenceData;
  }
  return null;
}

