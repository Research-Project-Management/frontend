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
   * Canonical Unified Ingestion endpoint (/api/v1/workspaces/:workspaceId/library/ingestion)
   */
  ingest: async (workspaceId: string, payload: UnifiedIngestionPayload): Promise<UnifiedIngestionResponse> => {
    const validatedPayload = UnifiedIngestionPayloadSchema.parse(payload);
    const res = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion`,
      validatedPayload,
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return UnifiedIngestionResponseSchema.parse(enveloped);
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
      payload,
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
