import { apiGet, apiPost, apiPatch, apiPut, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import type {
  Item,
  ItemBundle,
  ItemAttachment,
  PaginatedItemsResponse,
} from "@/features/library/types/library.types";
import { AttachmentsService } from './attachments.service';

// ── Payload sanitization ──────────────────────────────────────────────────────
const VALID_ITEM_PAYLOAD_KEYS = new Set([
  // Core bibliographic
  'title', 'year', 'doi', 'abstract', 'abstractNote', 'itemType',
  // Authors & creators
  'authors', 'creators', 'contributors', 'editors',
  // Publication venue
  'journal', 'publicationTitle', 'publicationDate', 'publisher', 'place', 'date',
  'volume', 'issue', 'section', 'partNumber', 'partTitle', 'pages',
  'series', 'seriesTitle', 'seriesText', 'seriesNumber',
  // Identifiers
  'issn', 'isbn', 'pmid', 'pmcid', 'arxivId', 'arxiv', 'doi',
  // Web & access
  'url', 'type', 'accessDate', 'accessedAt',
  // Style & formatting
  'language', 'journalAbbr', 'journalAbbreviation', 'shortTitle',
  'rights', 'license', 'citationKey', 'libraryCatalog',
  'archive', 'archiveLocation', 'callNumber',
  // Extra/custom fields
  'extra', 'extraFields', 'keywords', 'labels', 'tags',
  // Canonical relation inputs (sent on ingest/create, mapped server-side)
  'identifiers',
  // File upload reference — both fileId AND fileUrl must be allowed
  'fileId', 'fileUrl', 'filename', 'mimeType', 'size',
  // Collection targeting
  'collectionId', 'collectionIds',
  // Citation metrics
  'citationCount',
  // Type-specific fields across 37 item types
  'edition', 'numPages', 'numberOfVolumes', 'bookTitle', 'proceedingsTitle',
  'conferenceName', 'eventPlace', 'websiteTitle', 'websiteType',
  'university', 'institution', 'organization', 'identifier', 'country',
  'assignee', 'issuingAuthority', 'patentNumber', 'applicationNumber',
  'reportNumber', 'reportType', 'thesisType', 'genre', 'filingDate', 'legalStatus',
  'versionNumber', 'blogTitle', 'forumTitle', 'postType', 'presentationType',
  'meetingName', 'letterType', 'manuscriptType', 'mapType', 'scale',
  'artworkMedium', 'artworkSize', 'distributor', 'videoRecordingFormat',
  'audioRecordingFormat', 'runningTime', 'label', 'studio', 'network',
  'programTitle', 'episodeNumber', 'podcastType', 'interviewMedium',
  'dictionaryTitle', 'encyclopediaTitle', 'originalDate', 'originalPublisher',
  'originalPlace', 'session', 'history', 'committee', 'documentNumber',
  'court', 'docketNumber', 'firstPage', 'dateDecided', 'reporter',
  'reporterVolume', 'codeNumber', 'publicLawNumber', 'dateEnacted',
  'billNumber', 'codeVolume', 'codePages', 'legislativeBody',
  'code', 'system', 'company', 'programmingLanguage', 'standardNumber',
  'archiveID', 'format', 'repository', 'repositoryLocation',
  // Optimistic concurrency
  'version', 'expectedVersion',
  // User state inputs
  'cslType', 'readStatus', 'rating',
  // Quality flags
  'crossrefEnriched',
]);

export function sanitizeItemPayload(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (VALID_ITEM_PAYLOAD_KEYS.has(key) && data[key] !== undefined) {
      cleaned[key] = data[key];
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

  if (targetUrl.includes('r2.rpm.local')) {
    const match = targetUrl.match(/\/papers\/[^/?#]+/);
    targetUrl = match ? match[0] : targetUrl.replace(/^https?:\/\/[^/]+/, '');
  }

  // Static /papers files are served by Next.js, while API-backed files require
  // the backend origin and an auth token. Sending either through one generic
  // API fetcher breaks static preview URLs and leaks auth headers to external
  // PDFs (which browsers reject during CORS preflight).
  const isLocalStatic =
    targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');
  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const rawApiBase =
    typeof API_BASE_URL === 'string' &&
    API_BASE_URL !== 'undefined' &&
    API_BASE_URL !== 'null'
      ? API_BASE_URL.trim()
      : '';

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

    const resolvedOrigin = new URL(resolvedUrl, baseUrl).origin;
    const apiOrigin = rawApiBase ? new URL(rawApiBase, baseUrl).origin : new URL(baseUrl).origin;
    isTrustedOrigin =
      resolvedOrigin === new URL(baseUrl).origin ||
      resolvedOrigin === apiOrigin ||
      targetUrl.startsWith('/api/');
  } catch {
    isTrustedOrigin = targetUrl.startsWith('/api/');
  }

  const headers: Record<string, string> = {};
  const token = getAuthToken();
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
function getItemUrl(scopeId?: string, suffix = ''): string {
  const base = scopeId && scopeId !== 'user'
    ? `/api/v1/projects/${scopeId}/library/items`
    : `/api/v1/library/items`;
  return suffix ? `${base}/${suffix}` : base;
}

// ── ItemsService ──────────────────────────────────────────────────────────────
export const ItemsService = {
  importFromPersonal: (projectId: string, itemIds: string[]) => {
    if (!projectId || projectId === 'user') {
      throw new Error('Valid target projectId is required for personal library import');
    }
    return apiPost<{ success: boolean; importedCount: number }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/library/items/import`,
      { itemIds },
    );
  },

  getAll: (
    scopeId?: string,
    params?: {
      view?: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications';
      search?: string;
      collectionId?: string;
      tagId?: string;
      limit?: number;
      cursor?: string;
    },
  ) => {
    return apiGet<PaginatedItemsResponse>(
      getItemUrl(scopeId),
      { params },
    ).then((res) => {
      const items: Item[] = Array.isArray(res)
        ? res
        : res?.items || [];
      const meta = res?.pagination || res?.meta;
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
    apiGet<Item | { item?: Item; paper?: Item }>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
    ).then((res) => {
      const item: Item =
        res && typeof res === 'object' && 'item' in res && res.item
          ? (res.item as Item)
          : (res as Item);
      return {
        ...item,
        item,
        paper: item,
      };
    }),

  getAcademicBundle: (scopeId: string, itemId: string) =>
    ItemsService.getById(scopeId, itemId) as unknown as Promise<ItemBundle>,

  getByCollection: (scopeId: string, collectionId: string, search?: string) =>
    apiGet<any>(
      getItemUrl(scopeId),
      { params: { collectionId, ...(search ? { search } : {}) } },
    ).then((res) => {
      const papers: Item[] = Array.isArray(res)
        ? res
        : res?.items || res?.papers || res?.data || [];
      return {
        collection: res?.collection,
        items: papers,
        papers,
        data: papers,
      };
    }),

  create: (scopeId: string, collectionId: string, data: Partial<Item>) => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (collectionId) {
      payload.collectionId = collectionId;
    }
    return apiPost<any>(
      getItemUrl(scopeId),
      payload,
    ).then((res) => {
      const item = res?.item || res?.paper || res?.data || res;
      return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}) };
    });
  },

  update: async (
    scopeId: string,
    itemId: string,
    data: Partial<Item>,
    expectedVersion?: number,
  ) => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (expectedVersion !== undefined) {
      payload.expectedVersion = expectedVersion;
    }
    const res = await apiPatch<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    const item = (res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res;
    return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}), ...res };
  },

  patch: async (
    scopeId: string,
    itemId: string,
    data: Partial<Item>,
    expectedVersion?: number,
  ) => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (expectedVersion !== undefined) {
      payload.expectedVersion = expectedVersion;
    }
    const res = await apiPatch<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    const item = (res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res;
    return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}), ...res };
  },

  replace: async (
    scopeId: string,
    itemId: string,
    data: Partial<Item>,
    expectedVersion?: number,
  ) => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (expectedVersion !== undefined) {
      payload.expectedVersion = expectedVersion;
    }
    const res = await apiPut<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    const item = (res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res;
    return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}), ...res };
  },

  delete: (scopeId: string, itemId: string) =>
    apiDelete(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
    ),

  restore: (scopeId: string, itemId: string, expectedVersion?: number) => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    return apiPost<any>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/restore${versionQuery}`),
      {},
    ).then((res) => {
      const item = res?.item || res?.paper || res?.data || res;
      return { success: true, data: item, item, paper: item };
    });
  },

  purge: (scopeId: string, itemId: string) =>
    apiDelete<{ success: boolean; data: { purged: boolean } }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/purge`),
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
    const url = scopeId
      ? `/api/v1/library/ingestion/submit?projectId=${encodeURIComponent(scopeId)}`
      : `/api/v1/library/ingestion/submit`;
    return apiPost<{ item: Item }>(url, {
      kind: 'FILE',
      fileId: data.fileId,
      filename: data.filename,
      collectionIds: data.collectionId ? [data.collectionId] : undefined,
      projectId: scopeId || undefined,
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
    apiPost<{ message: string; itemId: string }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
    ),

  getItemTypes: (_scopeId?: string) =>
    apiGet<{ success: boolean; itemTypes: unknown[]; schemaVersion: number }>(
      `/api/v1/library/item-types`,
    ),

  getItemType: (_scopeId: string, itemType: string) =>
    apiGet<{ success: boolean; itemType: unknown; data: unknown }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
    ),

  previewConvertType: (
    scopeId: string,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra: boolean = true,
  ) =>
    apiPost<{ success: boolean; preview: unknown; data: unknown }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type/preview`),
      { targetType, retainUnmappedInExtra },
    ),

  convertType: (
    scopeId: string,
    itemId: string,
    targetType: string,
    expectedVersion?: number,
    retainUnmappedInExtra: boolean = true,
  ) =>
    apiPost<{ success: boolean; paper: Item; item: Item; conversionReport: unknown }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/convert-type`),
      { targetType, expectedVersion, retainUnmappedInExtra },
    ),

  fetchPdfBlob: (url: string, signal?: AbortSignal) =>
    fetchPdfBlob(url, signal),

  setMyPublication: (scopeId: string, itemId: string, isMyPublication: boolean) =>
    isMyPublication
      ? apiPost<{ success: boolean; data: Item; item: Item }>(
          getItemUrl(scopeId, `${encodeURIComponent(itemId)}/my-publication`),
          {},
        ).then((res) => res?.item || res?.data || res)
      : apiDelete<{ success: boolean; data: Item; item: Item }>(
          getItemUrl(scopeId, `${encodeURIComponent(itemId)}/my-publication`),
        ).then((res) => res?.item || res?.data || res),
};

export const ItemService = ItemsService;
export const PaperService = ItemsService;

// ── Item Relations & Curation (Re-exported from standalone services) ─────────
export { RelationService, RelationsService } from './relations.service';
export {
  QualityService,
  CurationService,
  type RawDuplicateCluster,
} from './curation.service';
