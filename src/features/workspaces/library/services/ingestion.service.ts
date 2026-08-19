import { apiGet, apiPost } from '@/shared/lib/api';
import type { AsyncIngestionJob, Paper } from '../types/library.types';

export const IngestionService = {
  /**
   * Async Non-blocking Batch Ingestion with job tracker
   */
  createBatchAsync: (
    workspaceId: string,
    items: Array<{
      sourceType: string;
      fileUrl?: string;
      doi?: string;
      bibtex?: string;
      title?: string;
      collectionId?: string | null;
    }>,
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
    items: Array<{
      sourceType: string;
      fileUrl?: string;
      doi?: string;
      bibtex?: string;
      title?: string;
      collectionId?: string | null;
    }>,
  ) =>
    apiPost<{
      summary: { total: number; successful: number; failed: number };
      results: Array<{ status: 'fulfilled' | 'rejected'; paper?: Paper; error?: string }>;
    }>('/api/library/ingest/batch', {
      workspaceId,
      items: items.map((i) => ({ ...i, workspaceId })),
    }),
};

// Aliases
export const createAsyncBatchJob = IngestionService.createBatchAsync;
export const getAsyncJobStatus = IngestionService.getJobStatus;
export const createBatchSync = IngestionService.createBatchSync;
