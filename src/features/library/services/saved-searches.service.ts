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
  getAll: (_workspaceId?: string) =>
    apiGet<SavedSearch[]>(
      `/api/v1/library/saved-searches`,
    ),

  getById: (_workspaceId: string, id: string) =>
    apiGet<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
    ),

  create: (_workspaceId: string, data: CreateSavedSearchInput) =>
    apiPost<SavedSearch>(
      `/api/v1/library/saved-searches`,
      data,
    ),

  update: (_workspaceId: string, id: string, data: UpdateSavedSearchInput) =>
    apiPatch<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      data,
    ),

  delete: (_workspaceId: string, id: string) =>
    apiDelete<{ success: boolean; id: string }>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
    ),

  preview: (_workspaceId: string, conditions: SavedSearchConditionGroup) =>
    apiPost<SavedSearchPreviewResponse>(
      `/api/v1/library/saved-searches/preview`,
      { conditions },
    ),

  getResults: (
    _workspaceId: string,
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
