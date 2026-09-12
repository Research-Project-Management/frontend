import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type {
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchResultsResponse,
  SavedSearchPreviewResponse,
  SavedSearchConditionGroup,
} from '../types/library.types';

export const SavedSearchService = {
  getAll: (workspaceId: string) =>
    apiGet<SavedSearch[]>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches`,
    ),

  getById: (workspaceId: string, id: string) =>
    apiGet<SavedSearch>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches/${encodeURIComponent(id)}`,
    ),

  create: (workspaceId: string, data: CreateSavedSearchInput) =>
    apiPost<SavedSearch>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches`,
      data,
    ),

  update: (workspaceId: string, id: string, data: UpdateSavedSearchInput) =>
    apiPatch<SavedSearch>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches/${encodeURIComponent(id)}`,
      data,
    ),

  delete: (workspaceId: string, id: string) =>
    apiDelete<{ success: boolean; id: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches/${encodeURIComponent(id)}`,
    ),

  preview: (workspaceId: string, conditions: SavedSearchConditionGroup) =>
    apiPost<SavedSearchPreviewResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches/preview`,
      { conditions },
    ),

  getResults: (
    workspaceId: string,
    id: string,
    params?: {
      limit?: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) =>
    apiGet<SavedSearchResultsResponse>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/saved-searches/${encodeURIComponent(id)}/results`,
      { params },
    ),
};
