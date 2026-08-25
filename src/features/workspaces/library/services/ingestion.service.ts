import { apiGet, apiPost } from '@/shared/lib/api';
import type { AsyncIngestionJob, IngestPaperDTO, Paper } from '../types/library.types';

export const IngestionService = {
  /**
   * Universal Single-document Academic Ingestion Engine
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
export const ingestDocument = IngestionService.ingestDocument;
export const createAsyncBatchJob = IngestionService.createBatchAsync;
export const getAsyncJobStatus = IngestionService.getJobStatus;
export const createBatchSync = IngestionService.createBatchSync;
