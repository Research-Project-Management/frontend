import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type {
  Item,
  FlagRetractionInput,
  RetractionStats,
} from '../types/library.types';

export const RetractionService = {
  getRetractedItems: (_workspaceId?: string) =>
    apiGet<Item[]>(
      `/api/v1/library/retraction/items`,
    ),

  getStats: (_workspaceId?: string) =>
    apiGet<RetractionStats>(
      `/api/v1/library/retraction/stats`,
    ),

  checkItem: (_workspaceId: string, itemId: string) =>
    apiPost<{
      itemId: string;
      isRetracted: boolean;
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/check`,
      {},
    ),

  checkWorkspace: (_workspaceId: string, itemIds?: string[]) =>
    apiPost<{ scanned: number; newlyRetracted: number }>(
      `/api/v1/library/retraction/check-all`,
      { itemIds },
    ),

  flagItem: (_workspaceId: string, itemId: string, data: FlagRetractionInput) =>
    apiPost<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
      data,
    ),

  unflagItem: (_workspaceId: string, itemId: string) =>
    apiDelete<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
    ),
};
