import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type {
  Item,
  FlagRetractionInput,
  RetractionStats,
} from '../../types/library.types';
import { isProjectScope } from './items.service';

export const RetractionService = {
  getRetractedItems: (scopeId?: string) =>
    apiGet<Item[]>(
      `/api/v1/library/retraction/items`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getStats: (scopeId?: string) =>
    apiGet<RetractionStats>(
      `/api/v1/library/retraction/stats`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  checkItem: (scopeId: string | undefined, itemId: string) =>
    apiPost<{
      itemId: string;
      isRetracted: boolean;
      nature?: string;
      details?: Record<string, unknown>;
    }>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/check`,
      {},
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  checkLibrary: (scopeId: string | undefined, itemIds?: string[]) =>
    apiPost<{ scanned: number; newlyRetracted: number }>(
      `/api/v1/library/retraction/check-all`,
      { itemIds },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  flagItem: (scopeId: string | undefined, itemId: string, data: FlagRetractionInput) =>
    apiPost<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  unflagItem: (scopeId: string | undefined, itemId: string) =>
    apiDelete<Item>(
      `/api/v1/library/retraction/items/${encodeURIComponent(itemId)}/flag`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),
};
