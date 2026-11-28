import type {
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchResultsResponse,
  SavedSearchPreviewResponse,
  SavedSearchConditionGroup,
  SavedSearchScopeOptions,
} from '@/features/library/types/core.types';
import {
  libraryClient,
  resolveLibraryUrl,
  isProjectScope,
  mapBackendItem,
} from './http.client';

export type {
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchConditionGroup,
};

// 6. SavedSearchesService
export const SavedSearchesService = {
  getAll: (spaceId?: string) =>
    libraryClient.get<SavedSearch[]>(
      resolveLibraryUrl('catalog', '/saved-searches', spaceId),
    ),

  create: (spaceId: string | undefined, data: CreateSavedSearchInput) => {
    const effectiveScope =
      (data as { targetScope?: string; scope?: string })?.targetScope ||
      (data as { scope?: string })?.scope ||
      spaceId;
    const { targetScope: _, scope: __, ...payload } = data;
    return libraryClient.post<SavedSearch>(
      resolveLibraryUrl('catalog', '/saved-searches', effectiveScope),
      {
        ...payload,
        ...(isProjectScope(effectiveScope) ? { spaceId: effectiveScope } : {}),
      },
    );
  },

  update: (spaceId: string | undefined, id: string, data: UpdateSavedSearchInput) => {
    const effectiveScope =
      (data as { targetScope?: string; scope?: string })?.targetScope ||
      (data as { scope?: string })?.scope ||
      spaceId;
    const { targetScope: _, scope: __, ...payload } = data;
    return libraryClient.patch<SavedSearch>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, effectiveScope),
      payload,
    );
  },

  delete: (spaceId: string | undefined, id: string) =>
    libraryClient.delete<{ success: boolean; id: string }>(
      resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}`, spaceId),
    ),

  preview: (
    spaceId: string | undefined,
    conditions: SavedSearchConditionGroup,
    options?: { sortBy?: string; sortOrder?: 'asc' | 'desc'; scopeOptions?: SavedSearchScopeOptions },
  ): Promise<SavedSearchPreviewResponse> =>
    libraryClient
      .post<SavedSearchPreviewResponse>(
        resolveLibraryUrl('catalog', '/saved-searches/preview', spaceId),
        {
          conditions,
          ...(options?.sortBy ? { sortBy: options.sortBy } : {}),
          ...(options?.sortOrder ? { sortOrder: options.sortOrder } : {}),
          ...(options?.scopeOptions || conditions.scopeOptions ? { scopeOptions: options?.scopeOptions || conditions.scopeOptions } : {}),
          ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
        },
      )
      .then((res) => ({
        ...res,
        sampleItems: Array.isArray(res?.sampleItems)
          ? res.sampleItems.map((it) => mapBackendItem(it))
          : [],
      })),

  getResults: (
    spaceId: string | undefined,
    id: string,
    params?: {
      limit?: number;
      page?: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: string;
    },
  ): Promise<SavedSearchResultsResponse> =>
    libraryClient
      .get<SavedSearchResultsResponse>(
        resolveLibraryUrl('catalog', `/saved-searches/${encodeURIComponent(id)}/execute`, spaceId),
        params ? { params } : undefined,
      )
      .then((res) => ({
        ...res,
        items: Array.isArray(res?.items)
          ? res.items.map((it) => mapBackendItem(it))
          : [],
      })),
};
