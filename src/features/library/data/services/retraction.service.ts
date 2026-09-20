import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type {
  Item,
  FlagRetractionInput,
  RetractionStats,
} from '../../types/library.types';

export const RetractionService = {
  getRetractedItems: (_scopeId?: string) =>
    apiGet<Item[]>(
      `/api/v1/library/retraction/items`,
    ),

  getStats: (_scopeId?: string) =>
    apiGet<RetractionStats>(
      `/api/v1/library/retraction/stats`,
    ),

  checkItem: (_scopeId: string, itemId: string) =>
    apiPost<{
      itemId: string;
      isRetracted: boolean;
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/check`,
      {},
    ),

  checkLibrary: (_scopeId: string, itemIds?: string[]) =>
    apiPost<{ scanned: number; newlyRetracted: number }>(
      `/api/v1/library/retraction/check-all`,
      { itemIds },
    ),



  flagItem: (_scopeId: string, itemId: string, data: FlagRetractionInput) =>
    apiPost<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
      data,
    ),

  unflagItem: (_scopeId: string, itemId: string) =>
    apiDelete<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
    ),
};
