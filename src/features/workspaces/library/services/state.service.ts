import { apiGet, apiPatch, apiPost } from "@/shared/lib/api";
import type { ItemStateData } from '../types/library.types';
export type { ItemStateData };

export const StateService = {
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

  /**
   * Batch-fetch reading states for multiple items.
   * Backed by POST /api/v1/workspaces/:workspaceId/library/items/state/batch
   */
  batchStates: (workspaceId: string, itemIds: string[]) =>
    apiPost<{ success: boolean; data: Record<string, ItemStateData> }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/state/batch`,
      { itemIds },
    ),
};

// Canonical Aliases
export const ReadingService = StateService;
export const ItemStateService = StateService;
export type UserItemStateData = ItemStateData;
export const UserStateService = StateService;
