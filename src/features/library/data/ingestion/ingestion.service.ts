import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import {
  type UnifiedIngestionPayload,
  type UnifiedIngestionResponse,
  type IngestionRunSnapshotResponse,
  type UrlCapturePreviewResponse,
  UnifiedIngestionPayloadSchema,
  UnifiedIngestionResponseSchema,
  UrlCapturePreviewResponseSchema,
  IngestionRunSnapshotResponseSchema,
} from '../../types';
import type {
  Item,
  DuplicateGroup,
  LibraryIntegrityReport,
  FlagRetractionInput,
  RetractionStats,
} from '../../types/library.types';
import { isProjectScope } from '../../domain';

export * from '../../types/ingestion.types';

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
    const res = await apiPost<any>(
      `/api/v1/library/ingestion/submit`,
      submission,
      { timeout: 30000 },
    );
    const accepted = res && typeof res === 'object' && 'data' in res ? res.data : res;
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
  captureUrl: async (_scopeId: string | undefined, url: string): Promise<UrlCapturePreviewResponse> => {
    const res = await apiPost<any>(
      `/api/v1/library/ingestion/capture-url`,
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
    apiPost<{ id: string; title: string; doi?: string; year?: number; citationKey?: string }>(
      `/api/v1/library/ingestion/confirm-url`,
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
      /** @deprecated Use value; retained for callers during migration. */
      identifierValue?: string;
      rawRecord?: string;
      content?: string;
      recordFormat?: 'BIBTEX' | 'RIS';
      format?: 'BIBTEX' | 'RIS';
      url?: string;
      fileId?: string;
      filename?: string;
      collectionId?: string;
      overrides?: Record<string, any>;
      idempotencyKey?: string;
    },
  ) => {
    const { identifierValue, value, rawRecord, content, recordFormat, format, ...rest } = payload;
    const resolvedValue = value ?? identifierValue;
    const resolvedContent = content ?? rawRecord;
    const resolvedFormat = format ?? recordFormat;
    return apiPost<{
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
      `/api/v1/library/ingestion/submit`,
      {
        ...rest,
        value: resolvedValue,
        identifierValue: resolvedValue,
        content: resolvedContent,
        rawRecord: resolvedContent,
        format: resolvedFormat,
        recordFormat: resolvedFormat,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    );
  },

  /**
   * Retry a failed ingestion run
   */
  retryRun: async (_scopeId: string | undefined, runId: string) =>
    apiPost<{
      success: boolean;
      data: {
        runId: string;
        statusUrl: string;
        acceptedAt: string;
        status: string;
      };
    }>(
      `/api/v1/library/ingestion/retry/${encodeURIComponent(runId)}`,
      {},
    ),

  /**
   * Query IngestionRun status
   */
  getRunStatus: async (_scopeId: string | undefined, runId: string): Promise<IngestionRunSnapshotResponse> => {
    const res = await apiGet<any>(
      `/api/v1/library/ingestion/status/${encodeURIComponent(runId)}`,
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    const parsed = IngestionRunSnapshotResponseSchema.safeParse(enveloped);
    if (parsed.success) {
      return parsed.data;
    }
    return enveloped as IngestionRunSnapshotResponse;
  },

  /**
   * Query real-time granular progress for batch/single ingestion runs
   */
  getRunProgress: async (_scopeId: string | undefined, runId: string): Promise<IngestionProgressResponse> => {
    const res = await apiGet<any>(
      `/api/v1/library/ingestion/status/${encodeURIComponent(runId)}/progress`,
    );
    const data = res && typeof res === 'object' && 'data' in res ? res.data : res;
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
  workspaceId?: string;
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

export const QualityService = {
  getDuplicates: async (scopeId?: string) => {
    const scopeParam = isProjectScope(scopeId)
      ? `?projectId=${encodeURIComponent(scopeId!)}`
      : '';
    const res = await apiGet<any>(
      `/api/v1/library/curation/duplicates${scopeParam}`,
    );

    const clusters: RawDuplicateCluster[] = Array.isArray(res)
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

  mergePapers: async (
    scopeId: string | undefined,
    masterPaperId: string,
    sourcePaperIds: string[],
    fieldSelections?: Record<string, any>,
  ) => {
    const scopeParam = isProjectScope(scopeId)
      ? `?projectId=${encodeURIComponent(scopeId!)}`
      : '';
    const res = await apiPost<any>(
      `/api/v1/library/curation/merge${scopeParam}`,
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

  getIntegrityReport: async (
    scopeId?: string,
  ): Promise<LibraryIntegrityReport> => {
    const res = await apiGet<any>(
      `/api/v1/library/curation/integrity`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    );
    return res?.data || res;
  },
};

// ── Retraction Service ────────────────────────────────────────────────────────

export const RetractionService = {
  getRetractedItems: (scopeId?: string) =>
    apiGet<Item[]>(
      `/api/v1/library/retraction/items`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getStats: (scopeId?: string) =>
    apiGet<RetractionStats>(
      `/api/v1/library/retraction/stats`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  checkItem: (scopeId: string | undefined, itemId: string) =>
    apiPost<{
      itemId: string;
      isRetracted: boolean;
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/check`,
      {},
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  checkLibrary: (scopeId: string | undefined, itemIds?: string[]) =>
    apiPost<{ scanned: number; newlyRetracted: number }>(
      `/api/v1/library/retraction/check-all`,
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  flagItem: (scopeId: string | undefined, itemId: string, data: FlagRetractionInput) =>
    apiPost<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  unflagItem: (scopeId: string | undefined, itemId: string) =>
    apiDelete<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
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
