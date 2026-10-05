import { apiGet, apiPost, apiPatch, apiPut, apiDelete, getAuthToken } from "@/shared/lib/api";
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
} from '../../types/library.types';
import type { ItemAttachment } from '../../types/attachments.types';
import { getPaperFileUrl, isProjectScope } from '../../domain';
import { AttachmentsService } from '../extraction/extraction.service';
import { ExportService, ExportsService } from '../citation/citation.service';

export { isProjectScope, getPaperFileUrl };
export type {
  TagWithCount,
  ItemStateData,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchConditionGroup,
};

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
  'issn', 'isbn', 'pmid', 'pmcid', 'arxivId', 'arxiv',
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
  'citationCount', 'referenceCount',
  // Type-specific fields across 37 item types
  'edition', 'numPages', 'numberOfVolumes', 'bookTitle', 'proceedingsTitle',
  'conferenceName', 'eventPlace', 'websiteTitle', 'websiteType',
  'university', 'institution', 'organization', 'identifier', 'country',
  'assignee', 'issuingAuthority', 'patentNumber', 'applicationNumber',
  'reportNumber', 'reportType', 'thesisType', 'genre', 'filingDate', 'issueDate',
  'priorityDate', 'priorityNumbers', 'references', 'legalStatus',
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
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
    : `/api/v1/library/items`;
  return suffix ? `${base}/${suffix}` : base;
}

// ── 1. ItemsService ───────────────────────────────────────────────────────────
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

  getCounts: (scopeId?: string) => {
    if (scopeId === 'adam-research' || scopeId === 'demo' || scopeId?.startsWith('mock-')) {
      return Promise.resolve({ total: 0, unfiled: 0, starred: 0, trash: 0 });
    }
    return apiGet<{ total: number; unfiled: number; starred: number; trash: number }>(
      getItemUrl(scopeId, 'counts'),
    );
  },

  getAll: (
    scopeId?: string,
    params?: (ItemQueryParams & { cursor?: string; fields?: string[] | string }) | {
      view?: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications' | string;
      search?: string;
      collectionId?: string;
      tagId?: string;
      limit?: number;
      cursor?: string;
      fields?: string[] | string;
      [key: string]: any;
    },
  ) => {
    if (scopeId === 'adam-research' || scopeId === 'demo' || scopeId?.startsWith('mock-')) {
      return Promise.resolve({
        items: [],
        papers: [],
        total: 0,
        meta: undefined,
        pagination: undefined,
      });
    }
    const formattedParams = params
      ? {
          ...params,
          fields: Array.isArray(params.fields)
            ? params.fields.join(',')
            : params.fields,
          tags: Array.isArray(params.tags)
            ? params.tags.join(',')
            : params.tags,
        }
      : undefined;
    return apiGet<PaginatedItemsResponse>(
      getItemUrl(scopeId),
      { params: formattedParams as Record<string, string | number | boolean | null | undefined> },
    ).then((res) => {
      const items: Item[] = Array.isArray(res)
        ? res
        : res?.items || [];
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

  getMetadataSources: (scopeId: string | undefined, itemId: string) =>
    apiGet<ItemMetadataSourcesResponse>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/metadata-sources`),
    ),

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

  create: (scopeId: string, collectionId: string, data: Partial<Item>): Promise<Item & { item: Item; paper: Item }> => {
    const payload = sanitizeItemPayload(data as Record<string, unknown>);
    if (collectionId) {
      payload.collectionId = collectionId;
    }
    return apiPost<any>(
      getItemUrl(scopeId),
      payload,
    ).then((res) => {
      const item = ((res?.item || res?.paper || res?.data || res) ?? {}) as Item;
      return { ...item, item, paper: item };
    });
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
    const res = await apiPatch<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    const item = (((res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res) ?? {}) as Item;
    return { ...item, item, paper: item };
  },

  patch: async (
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
    const res = await apiPatch<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    const item = (((res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res) ?? {}) as Item;
    return { ...item, item, paper: item };
  },

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
    const res = await apiPut<Record<string, unknown>>(
      getItemUrl(scopeId, encodeURIComponent(itemId)),
      payload,
    );
    const item = (((res as Record<string, unknown>)?.item || (res as Record<string, unknown>)?.paper || (res as Record<string, unknown>)?.data || res) ?? {}) as Item;
    return { ...item, item, paper: item };
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

  bulkPurge: (scopeId: string, itemIds: string[]) =>
    apiPost<{ success: boolean; count: number; purgedIds: string[] }>(
      getItemUrl(scopeId, 'bulk-purge'),
      { itemIds },
    ),

  bulkTrash: (scopeId: string, itemIds: string[]) =>
    apiPost<{ success: boolean; count: number; trashedIds: string[] }>(
      getItemUrl(scopeId, 'bulk-trash'),
      { itemIds },
    ),

  bulkRestore: (scopeId: string, itemIds: string[]) =>
    apiPost<{ success: boolean; count: number; restoredIds: string[] }>(
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
    return apiPost<{ item: Item }>(url, {
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
    apiPost<{ message: string; itemId: string }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
    ),

  getItemTypes: (_scopeId?: string) =>
    apiGet<any>(
      `/api/v1/library/item-types`,
      { rawEnvelope: true },
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

  reindexItem: (scopeId: string | undefined, itemId: string) =>
    apiPost<{ success: boolean; data?: any }>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/reindex`),
      {},
    ).then((res) => res?.data || res || { success: true }),

  getFulltext: (scopeId: string | undefined, itemId: string) =>
    apiGet<any>(
      getItemUrl(scopeId, `${encodeURIComponent(itemId)}/fulltext`),
    ).then((res) => res?.data || res || null).catch(() => null),

  getPaperFileUrl,

  getItem: (scopeId: string | undefined, itemId: string) =>
    ItemsService.getById(scopeId || 'user', itemId),

  updateItem: (scopeId: string | undefined, itemId: string, data: Partial<Item>) =>
    ItemsService.update(scopeId || 'user', itemId, data),

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

export interface ItemMetadataSourceItem {
  id: string;
  sourceProvider: string;
  sourceUri?: string | null;
  format?: string | null;
  fetchedAt: string;
  createdAt: string;
  rawPayload?: any;
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
    apiGet<{ collections: Collection[] }>(
      `/api/v1/library/collections`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  /**
   * Get hierarchical collection tree (for sidebar/tree view rendering)
   * Backed by GET /collections/tree
   */
  getTree: (scopeId?: string) =>
    apiGet<{ tree: Collection[] }>(
      `/api/v1/library/collections/tree`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  getById: (scopeId?: string, collectionId?: string) => {
    const effectiveScope = collectionId ? scopeId : undefined;
    const effectiveId = collectionId || scopeId || '';
    return apiGet<{ collection: Collection }>(
      `/api/v1/library/collections/${encodeURIComponent(effectiveId)}`,
      { params: isProjectScope(effectiveScope) ? { projectId: effectiveScope } : undefined },
    );
  },

  create: (scopeId: string | undefined, data: CreateCollectionDTO) =>
    apiPost<{ collection: Collection }>(
      `/api/v1/library/collections`,
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  update: (scopeId: string | undefined, collectionId: string, data: UpdateCollectionDTO) =>
    apiPut<{ collection: Collection }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}`,
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  delete: (scopeId: string | undefined, collectionId: string, strategy?: "cascade" | "move-to-parent" | "orphan") =>
    apiDelete(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}`,
      {
        params: {
          ...(strategy ? { strategy } : {}),
          ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
        },
      },
    ),

  moveItems: (scopeId: string | undefined, collectionId: string, itemIds: string[]) =>
    apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/move-items`,
      { itemIds, paperIds: itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  movePapers: (scopeId: string | undefined, collectionId: string, paperIds: string[]) =>
    apiPost<{ message: string; count: number; targetCollectionId: string | null }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/move-items`,
      { itemIds: paperIds, paperIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  reorder: (scopeId: string | undefined, collections: Array<{ id: string; parentId?: string | null }>) =>
    apiPatch<{ collections: Collection[] }>(
      `/api/v1/library/collections/reorder`,
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
    apiPost<{ count: number; collectionId: string }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/items`,
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined }
    ),

  /**
   * Remove a single item from a collection without deleting the item
   * Backed by DELETE /collections/:collectionId/items/:itemId
   */
  detachItem: (
    scopeId: string | undefined,
    collectionId: string,
    itemId: string,
  ) =>
    apiDelete<{ detached: boolean }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
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
    apiPost<{ success: boolean; count: number }>(
      `/api/v1/library/collections/${encodeURIComponent(collectionId)}/items/bulk-detach`,
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  exportBibtex: (scopeId: string | undefined, collectionId: string) => {
    const projectQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId)}${projectQuery}`,
    );
  },

  exportBundle: (_scopeId: string | undefined, collectionId: string) =>
    apiGet<{
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
    const raw = await apiGet<any>(basePath);
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
    const raw = await apiPost<any>(
      basePath,
      {
        name,
        color,
        type,
        ...(isProject ? { projectId: scopeId } : {}),
      },
    );
    return raw?.data || raw;
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
    const raw = await apiPatch<any>(
      `${basePath}/${encodeURIComponent(tagId)}`,
      data,
    );
    return raw?.data || raw;
  },

  delete: async (scopeId: string | undefined, tagId: string): Promise<void> => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/tags`
      : `/api/v1/library/tags`;
    await apiDelete<any>(
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
    const raw = await apiDelete<any>(
      `${basePath}/automatic`,
    );
    return raw?.data || raw || { count: 0 };
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
    await apiPost<any>(
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
    await apiDelete<any>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
    );
  },
};

export const TagService = TagsService;

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
    const raw = await apiGet<any>(`${basePath}${queryString}`);

    if (raw && typeof raw === 'object' && raw.success && Array.isArray(raw.data)) {
      return raw.data;
    }
    if (Array.isArray(raw)) {
      return raw;
    }
    return raw?.data || raw?.notes || [];
  },

  /**
   * Get single note by id
   */
  get: async (scopeId: string | undefined, id: string): Promise<Note> => {
    const basePath = getNotesBasePath(scopeId);
    const raw = await apiGet<any>(
      `${basePath}/${encodeURIComponent(id)}`,
    );

    if (raw && typeof raw === 'object' && raw.success && raw.data) {
      return raw.data;
    }
    return raw?.data || raw?.note || raw;
  },

  /**
   * Create a new canonical Note
   */
  create: async (scopeId: string | undefined, dto: CreateNoteDTO): Promise<Note> => {
    const isProject = isProjectScope(scopeId);
    const basePath = getNotesBasePath(scopeId);
    const raw = await apiPost<any>(
      basePath,
      {
        ...dto,
        ...(isProject ? { projectId: scopeId } : {}),
      },
    );

    if (raw && typeof raw === 'object' && raw.success && raw.data) {
      return raw.data;
    }
    return raw?.data || raw?.note || raw;
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
    const raw = await apiPatch<any>(
      `${basePath}/${encodeURIComponent(id)}`,
      {
        ...dto,
        expectedVersion,
      },
    );

    if (raw && typeof raw === 'object' && raw.success && raw.data) {
      return raw.data;
    }
    return raw?.data || raw?.note || raw;
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
    const raw = await apiDelete<any>(
      `${basePath}/${encodeURIComponent(id)}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },
};

export const getNotes = NotesService.list;
export const getNote = NotesService.get;
export const createNote = NotesService.create;
export const updateNote = NotesService.update;
export const deleteNote = NotesService.delete;
export const NoteService = NotesService;

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
    const res = await apiGet<ItemStateData | { data: ItemStateData }>(basePath);
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
    const res = await apiPatch<ItemStateData | { data: ItemStateData }>(
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
    const res = await apiPost<ItemStateData | { data: ItemStateData }>(
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
    const res = await apiPost<
      Record<string, ItemStateData> | { data: Record<string, ItemStateData> }
    >(basePath, { itemIds: itemIds ?? [] });
    return unwrapState(res) ?? {};
  },
};

export const ItemStateService = StateService;

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
    return apiGet<ItemTypesResponse>('/api/v1/library/item-types');
  },

  getSchemaSnapshot: () => {
    return apiGet<any>('/api/v1/library/item-types/schema');
  },

  getItemType: (itemType: string) => {
    return apiGet<ItemTypeDetailResponse>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
    );
  },

  getItemTypeFields: (itemType: string) => {
    return apiGet<ItemTypeFieldsResponse>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}/fields`,
    );
  },

  validateItem: (itemType: string, payload: Record<string, unknown>) => {
    return apiPost<{ success: boolean; result: SchemaValidationResult }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}/validate`,
      payload,
    );
  },
};

// ── 7. SavedSearchesService ───────────────────────────────────────────────────

export const SavedSearchesService = {
  getAll: (scopeId?: string) =>
    apiGet<SavedSearch[]>(
      `/api/v1/library/saved-searches`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getById: (scopeId: string | undefined, id: string) =>
    apiGet<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  create: (scopeId: string | undefined, data: CreateSavedSearchInput) =>
    apiPost<SavedSearch>(
      `/api/v1/library/saved-searches`,
      {
        ...data,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  update: (scopeId: string | undefined, id: string, data: UpdateSavedSearchInput) =>
    apiPatch<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  delete: (scopeId: string | undefined, id: string) =>
    apiDelete<{ success: boolean; id: string }>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  preview: (scopeId: string | undefined, conditions: SavedSearchConditionGroup) =>
    apiPost<SavedSearchPreviewResponse>(
      `/api/v1/library/saved-searches/preview`,
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
    apiGet<SavedSearchResultsResponse>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}/results`,
      {
        params: {
          ...params,
          ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
        },
      },
    ),
};

export const SavedSearchService = SavedSearchesService;

// ── 8. RelationsService ───────────────────────────────────────────────────────

export const RelationsService = {
  getRelated: (scopeId: string | undefined, itemId: string) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    return apiGet<{ relatedItems?: RelatedItem[]; relatedPapers?: RelatedItem[]; total?: number }>(
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
    return apiPost<{ message: string; relationType?: string; totalLinked?: number }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
      payload,
    );
  },

  unlink: (scopeId: string | undefined, itemId: string, targetItemId: string, _relationType?: string) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    return apiDelete<{ message: string }>(
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
