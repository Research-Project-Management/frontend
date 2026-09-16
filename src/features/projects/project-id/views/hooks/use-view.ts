'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ViewService } from '../services/view.service';
import type {
  WorkItemViewItem,
  CreateViewInput,
  UpdateViewInput,
  QueryViewInput,
  TViewFiltersSortKey,
  TViewFiltersSortBy,
} from '../types/view.types';

export const viewKeys = {
  all: ['project-views'] as const,
  list: (projectId: string, query?: QueryViewInput) =>
    ['project-views', projectId, query] as const,
  detail: (projectId: string, viewId: string) =>
    ['project-views', projectId, viewId] as const,
};

export function useProjectViews(projectId: string) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'public' | 'private'>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<TViewFiltersSortKey>('name');
  const [sortBy, setSortBy] = useState<TViewFiltersSortBy>('asc');

  const queryParams: QueryViewInput | undefined = useMemo(() => {
    const params: QueryViewInput = {};
    if (accessFilter === 'public' || accessFilter === 'private') {
      params.access = accessFilter;
    }
    if (onlyFavorites) {
      params.isFavorite = true;
    }
    if (search.trim()) {
      params.search = search.trim();
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [accessFilter, onlyFavorites, search]);

  const {
    data: views = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: viewKeys.list(projectId, queryParams),
    queryFn: () => ViewService.getViews(projectId, queryParams),
    enabled: Boolean(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateViewInput) => ViewService.createView(projectId, input),
    onSuccess: (newView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
      toast.success(`Created view "${newView.name}"`, { id: 'project-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create view', { id: 'project-view-action' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ viewId, input }: { viewId: string; input: UpdateViewInput }) =>
      ViewService.updateView(projectId, viewId, input),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
      toast.success(`Updated view "${updatedView.name}"`, { id: 'project-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update view', { id: 'project-view-action' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (viewId: string) => ViewService.deleteView(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
      toast.success('Deleted view successfully', { id: 'project-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete view', { id: 'project-view-action' });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (viewId: string) => ViewService.toggleFavorite(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to toggle favorite status', { id: 'project-view-action' });
    },
  });

  const duplicateView = async (view: WorkItemViewItem) => {
    try {
      await createMutation.mutateAsync({
        name: `Copy of ${view.name}`,
        description: view.description || undefined,
        layout: view.layout,
        filters: view.filters,
        displayProperties: view.displayProperties,
        access: view.access,
      });
    } catch {
      // Handled by onError in mutation
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setAccessFilter('all');
    setOnlyFavorites(false);
    setCreatorFilter(null);
  };

  const isFiltersApplied = useMemo(() => {
    return Boolean(search.trim() || accessFilter !== 'all' || onlyFavorites || creatorFilter);
  }, [search, accessFilter, onlyFavorites, creatorFilter]);

  // Client-side filtering and sorting for instant responsiveness
  const sortedAndFilteredViews = useMemo(() => {
    let result = [...views];

    if (creatorFilter) {
      result = result.filter(v => v.createdById === creatorFilter || v.createdBy?.id === creatorFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortKey === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === 'updatedAt') {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortBy === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [views, creatorFilter, sortKey, sortBy]);

  return {
    views,
    sortedViews: sortedAndFilteredViews,
    isLoading,
    isError,
    error,
    refetch,
    search,
    setSearch,
    accessFilter,
    setAccessFilter,
    onlyFavorites,
    setOnlyFavorites,
    creatorFilter,
    setCreatorFilter,
    sortKey,
    setSortKey,
    sortBy,
    setSortBy,
    clearAllFilters,
    isFiltersApplied,
    duplicateView,
    createView: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateView: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteView: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    toggleFavorite: toggleFavoriteMutation.mutateAsync,
    isFavoriting: toggleFavoriteMutation.isPending,
  };
}

export const useViewSettings = useProjectViews;
export default useProjectViews;

