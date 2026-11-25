/**
 * citations.client.ts
 *
 * Canonical Citations & Bibliography SDK client (4 endpoints).
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type { BibEntryDto } from './types';

export interface ListCitationsResponse {
  items: BibEntryDto[];
  total: number;
}

export interface BibMutationResponse {
  filePath: string;
  docId?: string;
  entries: BibEntryDto[];
  conflicts: string[];
}

export interface AsyncSyncEnqueuedResponse {
  jobId: string;
  status: 'queued';
}

export interface SyncJobStatusResponse {
  jobId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | string;
  progress?: number;
  result?: BibMutationResponse;
  failedReason?: string;
}

export const citations = {
  list: async (
    projectId: string,
    query = '',
    limit = 500,
  ): Promise<ListCitationsResponse> => {
    if (!projectId) return { items: [], total: 0 };
    const params = new URLSearchParams({ limit: String(limit) });
    if (query.trim()) {
      params.set('query', query.trim());
    }
    try {
      return await apiGet<ListCitationsResponse>(
        `${PAGES_API_BASE}/spaces/${projectId}/citations?${params.toString()}`,
        { silent: true },
      );
    } catch {
      return { items: [], total: 0 };
    }
  },

  upsertEntries: async (
    projectId: string,
    dto: {
      entries?: Array<Record<string, unknown>>;
      rawBibtex?: string;
      targetBibFile?: string;
    },
  ): Promise<BibMutationResponse> => {
    return await apiPost<BibMutationResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/entries`,
      dto,
    );
  },

  resolve: async (
    projectId: string,
    identifier: string,
    targetBibFile?: string,
  ): Promise<BibMutationResponse> => {
    return await apiPost<BibMutationResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/resolve`,
      { identifier, ...(targetBibFile ? { targetBibFile } : {}) },
    );
  },

  syncLibrary: async (
    projectId: string,
    dto: { collectionId: string; targetBibFile?: string },
  ): Promise<BibMutationResponse> => {
    return await apiPost<BibMutationResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/sync-library`,
      dto,
    );
  },

  syncLibraryAsync: async (
    projectId: string,
    dto: { collectionId: string; targetBibFile?: string },
  ): Promise<AsyncSyncEnqueuedResponse> => {
    return await apiPost<AsyncSyncEnqueuedResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/sync-library/async`,
      dto,
    );
  },

  getSyncJobStatus: async (
    projectId: string,
    jobId: string,
  ): Promise<SyncJobStatusResponse> => {
    return await apiGet<SyncJobStatusResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/sync-library/${encodeURIComponent(jobId)}`,
      { silent: true },
    );
  },

  syncLibraryWithPolling: async (
    projectId: string,
    dto: { collectionId: string; targetBibFile?: string },
    options?: {
      pollIntervalMs?: number;
      timeoutMs?: number;
      onProgress?: (status: SyncJobStatusResponse) => void;
    },
  ): Promise<BibMutationResponse> => {
    const { jobId } = await citations.syncLibraryAsync(projectId, dto);
    const pollIntervalMs = options?.pollIntervalMs ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await citations.getSyncJobStatus(projectId, jobId);
      options?.onProgress?.(status);

      if (status.state === 'completed' && status.result) {
        return status.result;
      }
      if (status.state === 'failed') {
        throw new Error(status.failedReason || 'Library sync job failed');
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error('Library sync job timed out');
  },
};
