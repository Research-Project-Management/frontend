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
} from '../types/view.types';

export const viewKeys = {
  all: ['project-views'] as const,
  list: (projectId: string, query?: QueryViewInput) =>
    ['project-views', projectId, query] as const,
  detail: (projectId: string, viewId: string) =>
    ['project-views', projectId, viewId] as const,
};

export function useViewSettings(projectId: string) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'public' | 'private'>('all');

  const queryParams: QueryViewInput | undefined = useMemo(() => {
    const params: QueryViewInput = {};
    if (accessFilter !== 'all') {
      params.access = accessFilter;
    }
    if (search.trim()) {
      params.search = search.trim();
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [accessFilter, search]);

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
      toast.success(`Created view "${newView.name}"`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create view');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ viewId, input }: { viewId: string; input: UpdateViewInput }) =>
      ViewService.updateView(projectId, viewId, input),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
      toast.success(`Updated view "${updatedView.name}"`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update view');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (viewId: string) => ViewService.deleteView(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
      toast.success('Deleted view successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete view');
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (viewId: string) => ViewService.toggleFavorite(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to toggle favorite status');
    },
  });

  return {
    views,
    isLoading,
    isError,
    error,
    refetch,
    search,
    setSearch,
    accessFilter,
    setAccessFilter,
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
