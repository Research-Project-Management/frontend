import { apiGet, apiPatch, apiPost } from "@/shared/lib/api";
import type { ItemStateData } from '../../types/library.types';
import { isProjectScope } from './items.service';
export type { ItemStateData };

export const StateService = {
  getState: async (scopeId?: string, itemId?: string): Promise<ItemStateData | null> => {
    if (!itemId) return null;
    const basePath = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/state`
      : `/api/v1/library/items/${encodeURIComponent(itemId)}/state`;
    const res = await apiGet<ItemStateData | { data: ItemStateData }>(basePath);
    return (res as any)?.data ?? res ?? null;
  },

  updateState: async (
    scopeId?: string,
    itemId?: string,
    data?: {
      isStarred?: boolean;
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
    },
  ): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/state`
      : `/api/v1/library/items/${encodeURIComponent(itemId)}/state`;
    const res = await apiPatch<ItemStateData | { data: ItemStateData }>(
      basePath,
      data ?? {},
    );
    return (res as any)?.data ?? res;
  },

  markAsRead: async (scopeId?: string, itemId?: string): Promise<ItemStateData> => {
    if (!itemId) throw new Error('itemId is required');
    const basePath = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/state/read`
      : `/api/v1/library/items/${encodeURIComponent(itemId)}/state/read`;
    const res = await apiPost<ItemStateData | { data: ItemStateData }>(
      basePath,
      {},
    );
    return (res as any)?.data ?? res;
  },

  /**
   * Batch-fetch reading states for multiple items.
   * Backed by POST /api/v1/library/items/state/batch
   */
  batchStates: async (
    scopeId?: string,
    itemIds?: string[],
  ): Promise<Record<string, ItemStateData>> => {
    const basePath = isProjectScope(scopeId)
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/state/batch`
      : `/api/v1/library/items/state/batch`;
    const res = await apiPost<
      Record<string, ItemStateData> | { data: Record<string, ItemStateData> }
    >(basePath, { itemIds: itemIds ?? [] });
    return (res as any)?.data ?? res ?? {};
  },
};

// Canonical Aliases
export const ReadingService = StateService;
export const ItemStateService = StateService;
export const UserStateService = StateService;
