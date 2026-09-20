import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type {
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchResultsResponse,
  SavedSearchPreviewResponse,
  SavedSearchConditionGroup,
} from '../../types/library.types';
import { isProjectScope } from './items.service';

export const SavedSearchesService = {
  getAll: (scopeId?: string) =>
    apiGet<SavedSearch[]>(
      `/api/v1/library/saved-searches`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getById: (scopeId: string | undefined, id: string) =>
    apiGet<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  create: (scopeId: string | undefined, data: CreateSavedSearchInput) =>
    apiPost<SavedSearch>(
      `/api/v1/library/saved-searches`,
      {
        ...data,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  update: (scopeId: string | undefined, id: string, data: UpdateSavedSearchInput) =>
    apiPatch<SavedSearch>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      data,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  delete: (scopeId: string | undefined, id: string) =>
    apiDelete<{ success: boolean; id: string }>(
      `/api/v1/library/saved-searches/${encodeURIComponent(id)}`,
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  preview: (scopeId: string | undefined, conditions: SavedSearchConditionGroup) =>
    apiPost<SavedSearchPreviewResponse>(
      `/api/v1/library/saved-searches/preview`,
      {
        conditions,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
      { params: isProjectScope(scopeId) ? { projectId: scopeId } : undefined },
    ),

  getResults: (
    scopeId: string | undefined,
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
      {
        params: {
          ...params,
          ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
        },
      },
    ),
};

export const SavedSearchService = SavedSearchesService;

