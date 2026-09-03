import { apiGet, apiPost, apiPut, apiPatch, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import type {
  Collection,
  CatalogItem,
  PaperAcademicBundle,
  PaperAttachment,
  IngestItemDTO,
  RelatedPaperItem,
  DuplicateGroup,
  Paper,
  LibraryIntegrityReport,
} from "@/features/workspaces/library/types/library.types";


// ── Ingestion DTO ─────────────────────────────────────────────────────────────
/** @deprecated Use IngestItemDTO from library.types */
export type IngestPaperDTO = IngestItemDTO;

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
  'citationCount', 'influentialCitationCount',
  // Type-specific fields across 37 item types
  'edition', 'numPages', 'numberOfVolumes', 'bookTitle', 'proceedingsTitle',
  'conferenceName', 'eventPlace', 'websiteTitle', 'websiteType',
  'university', 'institution', 'country',
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
export const sanitizePaperPayload = sanitizeItemPayload;

// ── CatalogItemService ────────────────────────────────────────────────────────
export const CatalogItemService = {
  getAll: (
    workspaceId: string,
    params?: {
      view?: 'all' | 'recent' | 'unfiled' | 'trash';
      search?: string;
      collectionId?: string;
      tagId?: string;
      limit?: number;
      cursor?: string;
    },
  ) => {
    return apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items`,
      { params },
    ).then((res) => {
      const items: CatalogItem[] = Array.isArray(res)
        ? res
        : res?.items || res?.papers || res?.data || [];
      const total =
        (res as any)?.meta?.totalCount ??
        (res as any)?.pagination?.totalCount ??
        (res as any)?.total ??
        items.length;
      const meta = (res as any)?.meta || (res as any)?.pagination;
      return {
        items,
        papers: items,
        total,
        meta,
      };
    });
  },

  getById: (workspaceId: string, itemId: string) =>
    apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}`,
    ).then((res) => {
      const item = res?.item || res?.paper || res?.data || res;
      return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}) };
    }),

  getAcademicBundle: (workspaceId: string, itemId: string) =>
    apiGet<PaperAcademicBundle>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/bundle`,
    ),

  getByCollection: (workspaceId: string, collectionId: string, search?: string) =>
    apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items`,
      { params: { collectionId, ...(search ? { search } : {}) } },
    ).then((res) => {
      const papers: CatalogItem[] = Array.isArray(res)
        ? res
        : res?.items || res?.papers || res?.data || [];
      return {
        collection: res?.collection,
        items: papers,
        papers,
        data: papers,
      };
    }),

  create: (workspaceId: string, collectionId: string, data: Partial<CatalogItem>) => {
    const payload = sanitizePaperPayload(data as Record<string, unknown>);
    if (collectionId) {
      payload.collectionId = collectionId;
    }
    return apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items`,
      payload,
    ).then((res) => {
      const item = res?.item || res?.paper || res?.data || res;
      return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}) };
    });
  },

  update: async (
    workspaceId: string,
    itemId: string,
    data: Partial<CatalogItem>,
    expectedVersion?: number,
  ) => {
    const payload = sanitizePaperPayload(data as Record<string, unknown>);
    const res = await apiPatch<Record<string, unknown>>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}`,
      payload,
      {
        headers: expectedVersion !== undefined
          ? { 'if-match': `"${expectedVersion}"` }
          : undefined,
      },
    );
    const item = (res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res;
    return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}), ...res };
  },

  /**
   * Partial update — PATCH /items/:id.
   * Sends only the provided fields; useful for updating a single field without
   * sending the full payload required by PUT.
   */
  patch: async (
    workspaceId: string,
    itemId: string,
    data: Partial<CatalogItem>,
    expectedVersion?: number,
  ) => {
    const payload = sanitizePaperPayload(data as Record<string, unknown>);
    const res = await apiPatch<Record<string, unknown>>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}`,
      payload,
      {
        headers: expectedVersion !== undefined
          ? { 'if-match': `"${expectedVersion}"` }
          : undefined,
      },
    );
    const item = (res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res;
    return { item, paper: item, ...(typeof item === 'object' && item !== null ? item : {}), ...res };
  },

  delete: (workspaceId: string, itemId: string) =>
    apiDelete(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}`,
    ),

  restore: (workspaceId: string, itemId: string, expectedVersion?: number) =>
    apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/restore`,
      {},
      {
        headers: expectedVersion
          ? { 'if-match': `"${expectedVersion}"` }
          : undefined,
      },
    ).then((res) => {
      const item = res?.item || res?.paper || res?.data || res;
      return { success: true, data: item, item, paper: item };
    }),

  purge: (workspaceId: string, itemId: string) =>
    apiDelete<{ success: boolean; data: { purged: boolean } }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/purge`,
    ),

  ingest: (workspaceId: string, data: IngestItemDTO) =>
    apiPost<{ item: CatalogItem }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion`,
      data,
    ),

  addAttachment: (
    workspaceId: string,
    itemId: string,
    data: Partial<PaperAttachment>
  ) =>
    apiPost<{ item: CatalogItem }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/attachments`,
      data
    ),

  deleteAttachment: (
    workspaceId: string,
    itemId: string,
    attachmentId: string
  ) =>
    apiDelete<{ item: CatalogItem }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/attachments/${encodeURIComponent(attachmentId)}`
    ),

  importFromStorage: (
    workspaceId: string,
    data: { fileId: string; collectionId?: string | null; title?: string; authors?: string[] }
  ) =>
    apiPost<{ item: CatalogItem }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/import-storage`,
      data
    ),

  reindex: (workspaceId: string, itemId: string) =>
    apiPost<{ message: string; itemId: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/reindex`,
    ),

  getItemTypes: (workspaceId: string) =>
    apiGet<{ success: boolean; itemTypes: unknown[]; schemaVersion: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/item-types`,
    ),

  /**
   * Get the field definition for a single item type.
   * Backed by GET /item-types/:itemType
   */
  getItemType: (workspaceId: string, itemType: string) =>
    apiGet<{ success: boolean; itemType: unknown; data: unknown }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/item-types/${encodeURIComponent(itemType)}`,
    ),

  previewConvertType: (
    workspaceId: string,
    itemId: string,
    targetType: string,
    retainUnmappedInExtra: boolean = true,
  ) =>
    apiPost<{ success: boolean; preview: unknown; data: unknown }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/convert-type/preview`,
      { targetType, retainUnmappedInExtra },
    ),

  convertType: (
    workspaceId: string,
    itemId: string,
    targetType: string,
    expectedVersion?: number,
    retainUnmappedInExtra: boolean = true,
  ) =>
    apiPost<{ success: boolean; paper: CatalogItem; item: CatalogItem; conversionReport: any }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/convert-type`,
      { targetType, expectedVersion, retainUnmappedInExtra },
    ),

  fetchPdfBlob: (url: string, signal?: AbortSignal) =>
    fetchPdfBlob(url, signal),
};

// ── Backwards-compatible Function Aliases ────────────────────────────────────
/** @deprecated Use CatalogItemService */
export const PaperService = CatalogItemService;
export const ingestPaper = CatalogItemService.ingest;
export const getAllPapers = CatalogItemService.getAll;
export const getPaperById = CatalogItemService.getById;
export const getPaperAcademicBundle = CatalogItemService.getAcademicBundle;
export const getItemTypes = CatalogItemService.getItemTypes;
export const previewConvertType = CatalogItemService.previewConvertType;
export const convertPaperType = CatalogItemService.convertType;
export const getCollectionPapers = CatalogItemService.getByCollection;
export const createPaper = CatalogItemService.create;
export const updatePaper = CatalogItemService.update;
export const deletePaper = CatalogItemService.delete;
export const restorePaper = CatalogItemService.restore;
export const purgePaper = CatalogItemService.purge;
export const addPaperAttachment = CatalogItemService.addAttachment;
export const deletePaperAttachment = CatalogItemService.deleteAttachment;
export const importPaperFromStorage = CatalogItemService.importFromStorage;
export const reindexPaper = CatalogItemService.reindex;

export const fetchPdfBlob = async (
  url: string,
  signal?: AbortSignal,
): Promise<Blob> => {
  let targetUrl = url;

  if (targetUrl.includes('r2.rpm.local')) {
    const match = targetUrl.match(/\/papers\/[^/?#]+/);
    targetUrl = match ? match[0] : targetUrl.replace(/^https?:\/\/[^/]+/, '');
  }

  const isLocalStatic =
    targetUrl.startsWith('/papers/') || targetUrl.startsWith('/public/');

  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';
  const apiOrigin = new URL(API_BASE_URL || baseUrl, baseUrl).origin;
  const currentOrigin = baseUrl;

  let resolvedUrlString: string;
  let isSameOrigin = false;

  try {
    resolvedUrlString = targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
      ? targetUrl
      : isLocalStatic
        ? targetUrl
        : `${API_BASE_URL}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

    const resolvedParsed = new URL(resolvedUrlString, baseUrl);
    isSameOrigin =
      resolvedParsed.origin === currentOrigin ||
      resolvedParsed.origin === apiOrigin;
  } catch {
    resolvedUrlString = targetUrl;
    isSameOrigin = false;
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token && isSameOrigin && !isLocalStatic) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrlString, {
    credentials: isSameOrigin && !isLocalStatic ? 'include' : 'same-origin',
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

// ── Item Relations ────────────────────────────────────────────────────────────

export const RelationService = {
  getRelated: (workspaceId: string, itemId: string) =>
    apiGet<{ relatedPapers: RelatedPaperItem[]; relatedItems?: RelatedPaperItem[]; total: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations`,
    ).then((res) => ({
      relatedItems: res.relatedItems || res.relatedPapers || [],
      relatedPapers: res.relatedPapers || res.relatedItems || [],
      total: res.total || (res.relatedItems || res.relatedPapers || []).length,
    })),

  link: (
    workspaceId: string,
    itemId: string,
    targetItemId: string,
    relationType: string = 'related',
  ) =>
    apiPost<{ message: string; relationType: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations`,
      { targetItemId, targetPaperId: targetItemId, relationType },
    ),

  unlink: (workspaceId: string, itemId: string, targetItemId: string) =>
    apiDelete<{ message: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`,
    ),
};

export const getRelatedItems = RelationService.getRelated;
export const getRelatedPapers = RelationService.getRelated;
export const linkItems = RelationService.link;
export const linkPapers = RelationService.link;
export const unlinkItems = RelationService.unlink;
export const unlinkPapers = RelationService.unlink;

// ── Item Curation & Quality ───────────────────────────────────────────────────

export interface DuplicateCluster {
  clusterId: string;
  matchReason: string;
  confidence: number;
  items: Array<{
    id: string;
    title: string;
    doi?: string;
    year?: number | null;
    authors?: string[];
    citationKey?: string;
    collectionId?: string | null;
  }>;
}

export type CanonicalDuplicateCluster = DuplicateCluster;

export const QualityService = {
  getDuplicates: async (workspaceId: string) => {
    const res = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/duplicates`,
    );

    const clusters: DuplicateCluster[] = Array.isArray(res)
      ? res
      : res?.data || res?.clusters || [];

    const duplicateGroups: DuplicateGroup[] = clusters.map((c) => ({
      matchType: c.matchReason === 'EXACT_DOI' ? 'DOI' : 'TITLE_AUTHOR_YEAR',
      confidence: c.confidence >= 1 ? 'high' : 'medium',
      key: c.clusterId,
      papers: (c.items || []).map((it) => ({
        id: it.id,
        title: it.title,
        doi: it.doi || '',
        authors: it.authors || [],
        year: it.year || null,
        citationKey: it.citationKey || '',
        collectionId: it.collectionId || null,
      })) as any,
    }));

    return {
      duplicateGroups,
      totalDuplicates: duplicateGroups.reduce(
        (acc, g) => acc + (g.papers?.length || 0),
        0,
      ),
    };
  },

  mergePapers: (
    workspaceId: string,
    masterPaperId: string,
    sourcePaperIds: string[],
    fieldSelections?: Record<string, any>,
  ) =>
    apiPost<{
      success: boolean;
      data: {
        masterPaper: Paper;
        mergedCount: number;
        softDeletedPaperIds: string[];
      };
      masterPaper?: Paper;
      mergedCount?: number;
      softDeletedPaperIds?: string[];
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/merge`,
      {
        primaryItemId: masterPaperId,
        duplicateItemIds: sourcePaperIds,
        fieldSelections,
      },
    ),

  getIntegrityReport: async (workspaceId: string): Promise<LibraryIntegrityReport> => {
    const res = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/integrity`,
    );
    return res?.data || res;
  },
};

export const getDuplicateGroups = QualityService.getDuplicates;
export const mergePapers = QualityService.mergePapers;
export const mergeItems = QualityService.mergePapers;
export const getLibraryIntegrityReport = QualityService.getIntegrityReport;

export const CatalogService = {
  ...CatalogItemService,
  relations: RelationService,
  quality: QualityService,
};

