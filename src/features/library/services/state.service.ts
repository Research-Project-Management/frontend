import { apiGet, apiPatch, apiPost } from "@/shared/lib/api";
import type { ItemStateData } from '../types/library.types';
export type { ItemStateData };

export const StateService = {
  getState: async (_workspaceId: string, itemId: string): Promise<ItemStateData | null> => {
    const res = await apiGet<ItemStateData | { data: ItemStateData }>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state`,
    );
    return (res as any)?.data ?? res ?? null;
  },

  updateState: async (
    _workspaceId: string,
    itemId: string,
    data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
    },
  ): Promise<ItemStateData> => {
    const res = await apiPatch<ItemStateData | { data: ItemStateData }>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state`,
      data,
    );
    return (res as any)?.data ?? res;
  },

  markAsRead: async (_workspaceId: string, itemId: string): Promise<ItemStateData> => {
    const res = await apiPost<ItemStateData | { data: ItemStateData }>(
      `/api/v1/library/items/${encodeURIComponent(itemId)}/state/read`,
      {},
    );
    return (res as any)?.data ?? res;
  },

  /**
   * Batch-fetch reading states for multiple items.
   * Backed by POST /api/v1/library/items/state/batch
   */
  batchStates: async (
    _workspaceId: string,
    itemIds: string[],
  ): Promise<Record<string, ItemStateData>> => {
    const res = await apiPost<
      Record<string, ItemStateData> | { data: Record<string, ItemStateData> }
    >(`/api/v1/library/items/state/batch`, { itemIds });
    return (res as any)?.data ?? res ?? {};
  },
};

// Canonical Aliases
export const ReadingService = StateService;
export const ItemStateService = StateService;
export type UserItemStateData = ItemStateData;
export const UserStateService = StateService;
