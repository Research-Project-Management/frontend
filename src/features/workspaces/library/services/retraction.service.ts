import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type {
  Item,
  FlagRetractionInput,
  RetractionStats,
} from '../types/library.types';

export const RetractionService = {
  getRetractedItems: (workspaceId: string) =>
    apiGet<Item[]>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/retraction/items`,
    ),

  getStats: (workspaceId: string) =>
    apiGet<RetractionStats>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/retraction/stats`,
    ),

  checkItem: (workspaceId: string, itemId: string) =>
    apiPost<{
      itemId: string;
      isRetracted: boolean;
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/retraction/items/${encodeURIComponent(itemId)}/check`,
      {},
    ),

  checkWorkspace: (workspaceId: string, itemIds?: string[]) =>
    apiPost<{ scanned: number; newlyRetracted: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/retraction/check-all`,
      { itemIds },
    ),

  flagItem: (workspaceId: string, itemId: string, data: FlagRetractionInput) =>
    apiPost<Item>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
      data,
    ),

  unflagItem: (workspaceId: string, itemId: string) =>
    apiDelete<Item>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
    ),
};
