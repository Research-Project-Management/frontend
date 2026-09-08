import { apiGet, apiPost } from '@/shared/lib/api';
import {
  type UnifiedIngestionPayload,
  type UnifiedIngestionResponse,
  type IngestionRunSnapshotResponse,
  type UrlCapturePreviewResponse,
  UnifiedIngestionPayloadSchema,
  UnifiedIngestionResponseSchema,
  UrlCapturePreviewResponseSchema,
  IngestionRunSnapshotResponseSchema,
} from '../schemas/ingestion.schema';

export * from '../schemas/ingestion.schema';

export const IngestionService = {
  /**
   * Submits work to the durable ingestion pipeline and returns immediately.
   * Long-running provider and PDF work is observed through the run-status API.
   */
  ingest: async (workspaceId: string, payload: UnifiedIngestionPayload): Promise<UnifiedIngestionResponse> => {
    const validatedPayload = UnifiedIngestionPayloadSchema.parse(payload);
    const submission = toSubmission(validatedPayload);
    const res = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/submit`,
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
  captureUrl: async (workspaceId: string, url: string): Promise<UrlCapturePreviewResponse> => {
    const res = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/capture-url`,
      { url },
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return UrlCapturePreviewResponseSchema.parse(enveloped);
  },

  /**
   * Confirm Captured URL metadata and persist CatalogItem
   */
  confirmUrl: (
    workspaceId: string,
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
    apiPost<{
      success: boolean;
      data: { id: string; title: string; doi?: string; year?: number; citationKey?: string };
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/confirm-url`,
      payload,
    ),

  /**
   * Fast-Path Async Ingestion 202 Submission (/api/v1/workspaces/:workspaceId/library/ingestion/submit)
   */
  submit: async (
    workspaceId: string,
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
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/submit`,
      {
        ...rest,
        value: resolvedValue,
        identifierValue: resolvedValue,
        content: resolvedContent,
        rawRecord: resolvedContent,
        format: resolvedFormat,
        recordFormat: resolvedFormat,
      },
    );
  },

  /**
   * Retry a failed ingestion run
   */
  retryRun: async (workspaceId: string, runId: string) =>
    apiPost<{
      success: boolean;
      data: {
        runId: string;
        statusUrl: string;
        acceptedAt: string;
        status: string;
      };
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/retry/${encodeURIComponent(runId)}`,
      {},
    ),

  /**
   * Query IngestionRun status scoped by workspaceId
   */
  getRunStatus: async (workspaceId: string, runId: string): Promise<IngestionRunSnapshotResponse> => {
    const res = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/status/${encodeURIComponent(runId)}`,
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return IngestionRunSnapshotResponseSchema.parse(enveloped);
  },

  /**
   * Query real-time granular progress for batch/single ingestion runs
   */
  getRunProgress: async (workspaceId: string, runId: string): Promise<IngestionProgressResponse> => {
    const res = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/status/${encodeURIComponent(runId)}/progress`,
    );
    const data = res && typeof res === 'object' && 'data' in res ? res.data : res;
    return data as IngestionProgressResponse;
  },
};

export interface IngestionProgressItem {
  title: string;
  status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED';
  itemId?: string;
  error?: string;
}

export interface IngestionProgressResponse {
  runId: string;
  workspaceId: string;
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

// Named re-exports for ergonomic use in hooks
export const ingestUnified = IngestionService.ingest;
export const captureUrl = IngestionService.captureUrl;
export const confirmUrl = IngestionService.confirmUrl;
export const getIngestionRunStatus = IngestionService.getRunStatus;


