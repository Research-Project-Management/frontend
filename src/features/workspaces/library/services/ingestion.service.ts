import { apiGet, apiPost } from '@/shared/lib/api';
import type { AsyncIngestionJob, IngestPaperDTO, Paper } from '../types/library.types';
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
    apiPost<{ success: boolean; data: Paper }>(
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
  retryRun: async (workspaceId: string, runId: string) => {
    return apiPost<{
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
    );
  },

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
   * Universal Single-document Academic Ingestion Engine (Legacy compatibility wrapper)
   */
  ingestDocument: (
    workspaceId: string,
    dto: IngestPaperDTO,
  ) =>
    apiPost<{
      id: string;
      title: string;
      citationKey: string;
      sourceType: string;
      doi?: string;
      year?: number | null;
      authors: string[];
      ragStatus?: string;
      collectionId?: string | null;
      fileUrl?: string | null;
      paper?: Paper;
    }>('/api/library/ingest', {
      ...dto,
      workspaceId,
    }),

  /**
   * Async Non-blocking Batch Ingestion with job tracker
   */
  createBatchAsync: (
    workspaceId: string,
    items: Array<IngestPaperDTO>,
  ) =>
    apiPost<{ jobId: string; status: string; total: number }>(
      '/api/library/ingest/batch-async',
      {
        workspaceId,
        items: items.map((i) => ({ ...i, workspaceId })),
      },
    ),

  /**
   * Poll Async Job Status and item results
   */
  getJobStatus: (jobId: string) =>
    apiGet<AsyncIngestionJob>(
      `/api/library/ingest/jobs/${encodeURIComponent(jobId)}`,
    ),

  /**
   * Sync Batch Ingestion
   */
  createBatchSync: (
    workspaceId: string,
    items: Array<IngestPaperDTO>,
  ) =>
    apiPost<{
      total: number;
      successCount: number;
      failedCount: number;
      successful: Paper[];
      failed: Array<{ item: IngestPaperDTO; error: string }>;
    }>('/api/library/ingest/batch', {
      workspaceId,
      items: items.map((i) => ({ ...i, workspaceId })),
    }),
};

// Aliases
export const ingestUnified = IngestionService.ingest;
export const captureUrl = IngestionService.captureUrl;
export const confirmUrl = IngestionService.confirmUrl;
export const getIngestionRunStatus = IngestionService.getRunStatus;
export const ingestDocument = IngestionService.ingestDocument;
export const createAsyncBatchJob = IngestionService.createBatchAsync;
export const getAsyncJobStatus = IngestionService.getJobStatus;
export const createBatchSync = IngestionService.createBatchSync;
