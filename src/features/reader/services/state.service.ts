import { apiGet, apiPatch, apiPost } from "@/shared/lib/api";
import type { DocumentReadingState } from '../types/reader.types';

export type ItemStateData = DocumentReadingState;

export interface UpdateReadingStatePayload {
  readStatus?: 'unread' | 'reading' | 'completed';
  rating?: number;
  currentPage?: number;
  scrollPosition?: Record<string, unknown> | Array<unknown> | null;
}

/**
 * StateService communicating with backend StateController (/api/v1/library/items/:itemId/state)
 */
export const StateService = {
  getState: (_scopeId: string | undefined, itemId: string) =>
    apiGet<ItemStateData>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state`,
    ),

  updateState: (
    _scopeId: string | undefined,
    itemId: string,
    data: UpdateReadingStatePayload,
  ) =>
    apiPatch<ItemStateData>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state`,
      data,
    ),

  markAsRead: (_scopeId: string | undefined, itemId: string) =>
    apiPost<ItemStateData>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state/read`,
      {},
    ),
};

export const ReadingService = StateService;
