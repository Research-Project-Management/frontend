import * as api from "@/shared/lib/api";
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
} from '@/features/library/types';
import type {
  Item,
  DuplicateGroup,
  LibraryIntegrityReport,
  FlagRetractionInput,
  RetractionStats,
} from '@/features/library/types/library.types';
import { isProjectScope } from '@/features/library/domain/item-url';

export * from '@/features/library/types/ingestion.types';

// ── URL Scope Resolvers ─────────────────────────────────────────────────────
function getIngestionUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/ingestion`
    : `/api/v1/library/ingestion`;
  return suffix ? `${base}/${suffix}` : base;
}

function getCurationUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/curation`
    : `/api/v1/library/curation`;
  return suffix ? `${base}/${suffix}` : base;
}

function getRetractionUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/retraction`
    : `/api/v1/library/retraction`;
  return suffix ? `${base}/${suffix}` : base;
}


// ── Ingestion Service ─────────────────────────────────────────────────────────

export const IngestionService = {
  /**
   * Submits work to the durable ingestion pipeline and returns immediately.
   * Long-running provider and PDF work is observed through the run-status API.
   */
  ingest: async (scopeId: string | undefined, payload: UnifiedIngestionPayload): Promise<UnifiedIngestionResponse> => {
    const validatedPayload = UnifiedIngestionPayloadSchema.parse(payload);
    const submission = {
      ...toSubmission(validatedPayload),
      ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
    };
    const res = await api.apiPost<Record<string, unknown>>(
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

  /**
   * Safe URL Capture and Metadata Preview
   */
  captureUrl: async (scopeId: string | undefined, url: string): Promise<UrlCapturePreviewResponse> => {
    const res = await api.apiPost<Record<string, unknown>>(
      getIngestionUrl(scopeId, 'capture-url'),
      { url },
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return UrlCapturePreviewResponseSchema.parse(enveloped);
  },

  /**
   * Confirm Captured URL metadata and persist Item
   */
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
    api.apiPost<{ id: string; title: string; doi?: string; year?: number; citationKey?: string }>(
      getIngestionUrl(scopeId, 'confirm-url'),
      {
        ...payload,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    ),

  /**
   * Fast-Path Async Ingestion 202 Submission (/api/v1/library/ingestion/submit)
   */
  submit: async (
    scopeId: string | undefined,
    payload: {
      kind: 'IDENTIFIER' | 'RECORD' | 'URL' | 'FILE' | 'CONNECTOR';
      identifierType?: 'DOI' | 'ARXIV' | 'PMID' | 'ISBN';
      value?: string;
      content?: string;
      format?: 'BIBTEX' | 'RIS';
      url?: string;
      fileId?: string;
      filename?: string;
      collectionId?: string;
      collectionIds?: string[];
      overrides?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ) => {
    return api.apiPost<{
      success: boolean;
      data: {
        runId: string;
        statusUrl: string;
        acceptedAt: string;
        requestHash: string;
        status: string;
        deduplicated?: boolean;
      };
    }>(
      getIngestionUrl(scopeId, 'submit'),
      {
        ...payload,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
  },

  /**
   * Retry a failed ingestion run
   */
  retryRun: async (scopeId: string | undefined, runId: string) =>
    api.apiPost<{
      success: boolean;
      data: {
        runId: string;
        statusUrl: string;
        acceptedAt: string;
        status: string;
      };
    }>(
      getIngestionUrl(scopeId, `retry/${encodeURIComponent(runId)}`),
      {},
    ),

  /**
   * Query IngestionRun status
   */
  getRunStatus: async (scopeId: string | undefined, runId: string): Promise<IngestionRunSnapshotResponse> => {
    const res = await api.apiGet<Record<string, unknown>>(
      getIngestionUrl(scopeId, `status/${encodeURIComponent(runId)}`),
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    const parsed = IngestionRunSnapshotResponseSchema.safeParse(enveloped);
    if (parsed.success) {
      return parsed.data;
    }
    const rawData =
      enveloped && typeof enveloped === 'object' && 'data' in enveloped && enveloped.data && typeof enveloped.data === 'object'
        ? (enveloped.data as Record<string, unknown>)
        : {};
    return {
      success: true,
      data: {
        status: typeof rawData.status === 'string' ? rawData.status : 'processing',
        sourceType: typeof rawData.sourceType === 'string' ? rawData.sourceType : 'unknown',
        totalItems: typeof rawData.totalItems === 'number' ? rawData.totalItems : 1,
        processedItems: typeof rawData.processedItems === 'number' ? rawData.processedItems : 0,
        failedItems: typeof rawData.failedItems === 'number' ? rawData.failedItems : 0,
        startedAt: typeof rawData.startedAt === 'string' ? rawData.startedAt : new Date().toISOString(),
        ...rawData,
      },
    };
  },

  /**
   * Query real-time granular progress for batch/single ingestion runs
   */
  getRunProgress: async (scopeId: string | undefined, runId: string): Promise<IngestionProgressResponse> => {
    const res = await api.apiGet<IngestionProgressResponse | { data: IngestionProgressResponse }>(
      getIngestionUrl(scopeId, `status/${encodeURIComponent(runId)}/progress`),
    );
    const data = res && typeof res === 'object' && 'data' in res && res.data ? res.data : res;
    return data as IngestionProgressResponse;
  },
};

export interface IngestionProgressItem {
  title: string;
  status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'PROCESSING' | 'UPLOADING' | 'PENDING';
  itemId?: string;
  error?: string;
  itemName?: string;
}

export interface IngestionProgressResponse {
  runId: string;
  scopeId?: string;
  projectId?: string;
  userId?: string;
  status: string;
  total: number;
  processed: number;
  percentage: number;
  succeeded: number;
  duplicates: number;
  failed: number;
  currentTitle?: string;
  items: IngestionProgressItem[];
  startedAt: string;
  completedAt?: string;
}

function toSubmission(payload: UnifiedIngestionPayload) {
  const common = {
    collectionIds: payload.collectionId ? [payload.collectionId] : undefined,
    overrides: 'overrides' in payload ? payload.overrides : undefined,
    idempotencyKey: payload.idempotencyKey,
  };

  switch (payload.source) {
    case 'doi':
      return {
        ...common,
        kind: 'IDENTIFIER' as const,
        identifierType: 'DOI' as const,
        value: payload.doi,
      };
    case 'arxiv':
      return {
        ...common,
        kind: 'IDENTIFIER' as const,
        identifierType: 'ARXIV' as const,
        value: payload.arxivId,
      };
    case 'pmid':
      return {
        ...common,
        kind: 'IDENTIFIER' as const,
        identifierType: 'PMID' as const,
        value: payload.pmid,
      };
    case 'isbn':
      return {
        ...common,
        kind: 'IDENTIFIER' as const,
        identifierType: 'ISBN' as const,
        value: payload.isbn,
      };
    case 'bibtex':
      return {
        ...common,
        kind: 'RECORD' as const,
        format: 'BIBTEX' as const,
        content: payload.content || payload.bibtex || '',
      };
    case 'ris':
      return {
        ...common,
        kind: 'RECORD' as const,
        format: 'RIS' as const,
        content: payload.content || payload.ris || '',
      };
    case 'url':
      return {
        ...common,
        kind: 'URL' as const,
        url: payload.url,
        previewToken: payload.previewToken,
      };
    case 'pdf':
      return {
        ...common,
        kind: 'FILE' as const,
        fileId: payload.fileId,
        filename: payload.filename,
      };
    case 'zotero':
      return {
        ...common,
        kind: 'CONNECTOR' as const,
        connectionId: payload.connectionId,
        externalObjectId: payload.externalItemKey,
        externalVersion: '1',
      };
  }
}

// ── Curation & Duplicates Service ─────────────────────────────────────────────

export interface RawDuplicateCluster {
  clusterId: string;
  matchReason: string;
  confidence: number;
  recommendedMasterId?: string;
  items: Array<{
    id: string;
    title: string;
    itemType?: string;
    doi?: string;
    year?: number | null;
    authors?: string[];
    citationKey?: string;
    collectionId?: string | null;
    [key: string]: unknown;
  }>;
}

export const QualityService = {
  getDuplicates: async (scopeId?: string) => {
    const res = await api.apiGet<RawDuplicateCluster[] | { data?: RawDuplicateCluster[]; clusters?: RawDuplicateCluster[] }>(
      getCurationUrl(scopeId, 'duplicates'),
    );

    const clusters: RawDuplicateCluster[] = Array.isArray(res)
      ? res
      : (res && 'data' in res && Array.isArray(res.data) ? res.data : res && 'clusters' in res && Array.isArray(res.clusters) ? res.clusters : []);

    const duplicateGroups: DuplicateGroup[] = clusters.map((c) => {
      const parsedPapers = (c.items || []).map((it) => {
        const rawTags = Array.isArray(it.tags)
          ? it.tags.map((t: unknown) =>
              typeof t === 'string'
                ? t
                : t && typeof t === 'object' && 'name' in t
                  ? String((t as { name: unknown }).name)
                  : '',
            ).filter(Boolean)
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
    const res = await api.apiPost<MergeApiResponse>(
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
      data: {
        masterPaper,
        mergedCount,
        softDeletedPaperIds,
      },
      masterPaper,
      primaryItem: masterPaper,
      mergedCount,
      softDeletedPaperIds,
      softDeletedItemIds: softDeletedPaperIds,
    };
  },

  dismissDuplicates: async (scopeId: string | undefined, itemIds: string[]) =>
    api.apiPost<{ dismissed: boolean; itemIds: string[] }>(
      getCurationUrl(scopeId, 'duplicates/dismiss'),
      { itemIds },
    ),

  reResolveMetadata: async (
    scopeId: string | undefined,
    itemId: string,
    options?: {
      doi?: string;
      arxivId?: string;
      pmid?: string;
      isbn?: string;
      title?: string;
      forceRefresh?: boolean;
      expectedVersion?: number;
      fields?: string[];
      aggressive?: boolean;
    },
  ): Promise<Record<string, unknown>> => {
    return api.apiPost<Record<string, unknown>>(
      getCurationUrl(scopeId, `items/${encodeURIComponent(itemId)}/re-resolve`),
      options || {},
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    );
  },

  getQualityAudit: (scopeId?: string) => QualityService.getIntegrityReport(scopeId),

  getIntegrityReport: async (
    scopeId?: string,
  ): Promise<LibraryIntegrityReport> => {
    const res = await api.apiGet<LibraryIntegrityReport | { data: LibraryIntegrityReport }>(
      getCurationUrl(scopeId, 'integrity'),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    );
    return (res && 'data' in res && res.data ? res.data : res) as LibraryIntegrityReport;
  },
};

// ── Retraction Service ────────────────────────────────────────────────────────

export const RetractionService = {
  getDatabaseStats: () =>
    api.apiGet<Record<string, unknown>>('/api/v1/library/retraction/database/stats'),

  syncLibrary: (scopeId?: string, options?: { maxDays?: number; limit?: number }) =>
    api.apiPost<{ synced?: boolean; count?: number; [key: string]: unknown }>(
      getRetractionUrl(scopeId, 'sync'),
      options || {},
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getRetractedItems: (scopeId?: string) =>
    api.apiGet<Item[]>(
      getRetractionUrl(scopeId, 'items'),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getStats: (scopeId?: string) =>
    api.apiGet<RetractionStats>(
      getRetractionUrl(scopeId, 'stats'),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  checkItem: (scopeId: string | undefined, itemId: string) =>
    api.apiPost<{
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
    api.apiPost<{ scanned: number; newlyRetracted: number }>(
      getRetractionUrl(scopeId, 'check-all'),
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  flagItem: (scopeId: string | undefined, itemId: string, data: FlagRetractionInput) =>
    api.apiPost<Item>(
      getRetractionUrl(scopeId, `items/${encodeURIComponent(itemId)}/flag`),
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  unflagItem: (scopeId: string | undefined, itemId: string) =>
    api.apiDelete<Item>(
      getRetractionUrl(scopeId, `items/${encodeURIComponent(itemId)}/flag`),
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),
};

// ── Aliases & Domain Service ──────────────────────────────────────────────────

export const CurationService = QualityService;
export const ingestUnified = IngestionService.ingest;
export const captureUrl = IngestionService.captureUrl;
export const confirmUrl = IngestionService.confirmUrl;
export const getIngestionRunStatus = IngestionService.getRunStatus;

export const IngestionDomainService = {
  ingestion: IngestionService,
  curation: QualityService,
  retraction: RetractionService,
};
