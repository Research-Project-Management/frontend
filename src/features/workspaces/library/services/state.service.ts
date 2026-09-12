import { apiGet, apiPatch, apiPost } from "@/shared/lib/api";
import type { ItemStateData } from '../types/library.types';
export type { ItemStateData };

export const StateService = {
  getState: (_workspaceId: string, itemId: string) =>
    apiGet<{ success: boolean; data: ItemStateData }>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state`,
    ),

  updateState: (
    _workspaceId: string,
    itemId: string,
    data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
    },
  ) =>
    apiPatch<{ success: boolean; data: ItemStateData }>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state`,
      data,
    ),

  markAsRead: (_workspaceId: string, itemId: string) =>
    apiPost<{ success: boolean; data: ItemStateData }>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state/read`,
      {},
    ),

  /**
   * Batch-fetch reading states for multiple items.
   * Backed by POST /api/v1/library/items/state/batch
   */
  batchStates: (_workspaceId: string, itemIds: string[]) =>
    apiPost<{ success: boolean; data: Record<string, ItemStateData> }>(
      `/api/v1/library/items/state/batch`,
      { itemIds },
    ),
};

// Canonical Aliases
export const ReadingService = StateService;
export const ItemStateService = StateService;
export type UserItemStateData = ItemStateData;
export const UserStateService = StateService;
