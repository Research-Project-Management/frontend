import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type {
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchResultsResponse,
  SavedSearchPreviewResponse,
  SavedSearchConditionGroup,
} from '../types/library.types';

export const SavedSearchesService = {
  getAll: (_scopeId?: string) =>
    apiGet<SavedSearch[]>(
      `/api/v1/library/saved-searches`,
    ),

  getById: (_scopeId: string, id: string) =>
    apiGet<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
    ),

  create: (_scopeId: string, data: CreateSavedSearchInput) =>
    apiPost<SavedSearch>(
      `/api/v1/library/saved-searches`,
      data,
    ),

  update: (_scopeId: string, id: string, data: UpdateSavedSearchInput) =>
    apiPatch<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      data,
    ),

  delete: (_scopeId: string, id: string) =>
    apiDelete<{ success: boolean; id: string }>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
    ),

  preview: (_scopeId: string, conditions: SavedSearchConditionGroup) =>
    apiPost<SavedSearchPreviewResponse>(
      `/api/v1/library/saved-searches/preview`,
      { conditions },
    ),

  getResults: (
    _scopeId: string,
    id: string,
    params?: {
      limit?: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) =>
    apiGet<SavedSearchResultsResponse>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}/results`,
      { params },
    ),
};

export const SavedSearchService = SavedSearchesService;
