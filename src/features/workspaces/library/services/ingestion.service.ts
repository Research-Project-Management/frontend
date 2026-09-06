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
      recordFormat?: 'BIBTEX' | 'RIS';
      url?: string;
      fileId?: string;
      collectionId?: string;
      overrides?: Record<string, any>;
      idempotencyKey?: string;
    },
  ) => {
    const { identifierValue, value, ...rest } = payload;
    const resolvedValue = value ?? identifierValue;
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
};

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
    case 'bibtex':
      return {
        ...common,
        kind: 'RECORD' as const,
        format: 'BIBTEX' as const,
        content: payload.content || payload.bibtex || '',
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

// ── Legacy specific-type ingestion methods ────────────────────────────────────
// These call the named legacy routes (POST /ingestion/doi, /bibtex, /pdf, /start)
// Prefer IngestionService.ingest() or .submit() for new code.

export const LegacyIngestionService = {
  /**
   * Ingest by DOI directly.
   * Backed by POST /ingestion/doi
   */
  ingestDoi: (
    workspaceId: string,
    doi: string,
    options?: { collectionId?: string; idempotencyKey?: string },
  ) =>
    apiPost<{ success: boolean; data: any }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/doi`,
      { doi, ...options },
    ),

  /**
   * Ingest raw BibTeX string.
   * Backed by POST /ingestion/bibtex
   */
  ingestBibtex: (
    workspaceId: string,
    content: string,
    options?: { collectionId?: string; idempotencyKey?: string },
  ) =>
    apiPost<{ success: boolean; data: any }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/bibtex`,
      { content, bibtex: content, ...options },
    ),

  /**
   * Ingest a PDF file by fileId.
   * Backed by POST /ingestion/pdf
   */
  ingestPdf: (
    workspaceId: string,
    fileId: string,
    options?: { filename?: string; collectionId?: string; overrides?: Record<string, any>; idempotencyKey?: string },
  ) =>
    apiPost<{ success: boolean; data: any }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/pdf`,
      { fileId, ...options },
    ),

  /**
   * Start a pre-configured ingestion run.
   * Backed by POST /ingestion/start
   */
  startRun: (
    workspaceId: string,
    payload: {
      source: string;
      doi?: string;
      url?: string;
      fileId?: string;
      content?: string;
      collectionId?: string;
      idempotencyKey?: string;
      overrides?: Record<string, any>;
    },
  ) =>
    apiPost<{ success: boolean; data: any }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion/start`,
      payload,
    ),
};
