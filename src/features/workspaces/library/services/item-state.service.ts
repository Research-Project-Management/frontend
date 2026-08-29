import { apiGet, apiPatch, apiPost } from '@/shared/lib/api';

export interface ItemStateData {
  readStatus: 'unread' | 'reading' | 'completed';
  rating: number;
  lastReadAt: string | null;
}

export const itemStateKeys = {
  all: (workspaceId: string) => ['item-state', workspaceId] as const,
  byItem: (workspaceId: string, itemId: string) =>
    ['item-state', workspaceId, itemId] as const,
};

export const ItemStateService = {
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

// Aliases
export type UserItemStateData = ItemStateData;
export const userStateKeys = itemStateKeys;
export const UserStateService = ItemStateService;
