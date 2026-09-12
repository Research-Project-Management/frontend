'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TagService, type TagWithCount } from '../services/tag.service';

export const tagKeys = {
  all: ['tags'] as const,
  list: (scopeId?: string) => [...tagKeys.all, scopeId || 'user'] as const,
};

export function useTags(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const tagsQuery = useQuery({
    queryKey: tagKeys.list(effectiveScope),
    queryFn: () => TagService.list(effectiveScope),
    enabled: true,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, color, type }: { name: string; color?: string; type?: string }) =>
      TagService.create(effectiveScope, name, color, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Tag created');
    },
    onError: (err: any) => {
      toast.error('Failed to create tag', {
        description: err?.message || 'Please try again.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => TagService.delete(effectiveScope, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Tag deleted');
    },
    onError: (err: any) => {
      toast.error('Failed to delete tag', {
        description: err?.message || 'Please try again.',
      });
    },
  });

  const deleteAutomaticMutation = useMutation({
    mutationFn: () => TagService.deleteAutomatic(effectiveScope),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(`Removed ${data?.count ?? 0} automatic tags`);
    },
    onError: (err: any) => {
      toast.error('Failed to delete automatic tags', {
        description: err?.message || 'Please try again.',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ tagId, itemId }: { tagId: string; itemId: string }) =>
      TagService.assignToItem(effectiveScope, tagId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ tagId, itemId }: { tagId: string; itemId: string }) =>
      TagService.removeFromItem(effectiveScope, tagId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const tags = (tagsQuery.data || []) as TagWithCount[];

  return {
    tags,
    isLoading: tagsQuery.isLoading,
    isError: tagsQuery.isError,
    error: tagsQuery.error,
    refetch: tagsQuery.refetch,
    createTag: createMutation.mutateAsync,
    deleteTag: deleteMutation.mutateAsync,
    deleteAutomaticTags: deleteAutomaticMutation.mutateAsync,
    isDeletingAutomatic: deleteAutomaticMutation.isPending,
    assignTag: assignMutation.mutateAsync,
    removeTag: removeMutation.mutateAsync,
  };
}