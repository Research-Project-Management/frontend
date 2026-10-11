/**
 * updater.api.ts
 *
 * Document updater service for batch updates, buffer flushing, and state eviction.
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { QueueUpdatePayload, FlushResultDto } from './types';

export const updater = {
  queueUpdate: async (
    projectId: string,
    docId: string,
    dto: QueueUpdatePayload,
  ): Promise<any> => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/update`,
      dto,
    );
  },

  flushProject: async (
    projectId: string,
    force = false,
  ): Promise<FlushResultDto> => {
    return await apiPost<FlushResultDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/flush`,
      { force },
      { silent: true },
    );
  },

  flushDoc: async (
    projectId: string,
    docId: string,
  ): Promise<{ flushed: boolean; docId: string; version: number }> => {
    return await apiPost<{ flushed: boolean; docId: string; version: number }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/flush`,
      {},
    );
  },

  getDocState: async (
    projectId: string,
    docId: string,
  ): Promise<any> => {
    return await apiGet<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/state`,
    );
  },

  evictDoc: async (
    projectId: string,
    docId: string,
  ): Promise<void> => {
    await apiDelete(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/buffer`,
    );
  },
};
