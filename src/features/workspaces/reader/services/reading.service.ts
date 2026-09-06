import { apiGet, apiPatch, apiPost } from '@/shared/lib/api';
import type { DocumentReadingState } from '../types/reader.types';

export type ItemStateData = DocumentReadingState;

/**
 * ReadingService corresponding to backend ReadingService (backend/src/modules/library/reading/reading.service.ts)
 */
export const ReadingService = {
  getState: (workspaceId: string, itemId: string) =>
    apiGet<{ success: boolean; data: ItemStateData }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/state`,
    ),

  updateState: (
    workspaceId: string,
    itemId: string,
    data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
    },
  ) =>
    apiPatch<{ success: boolean; data: ItemStateData }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/state`,
      data,
    ),

  markAsRead: (workspaceId: string, itemId: string) =>
    apiPost<{ success: boolean; data: ItemStateData }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/state/read`,
      {},
    ),
};
