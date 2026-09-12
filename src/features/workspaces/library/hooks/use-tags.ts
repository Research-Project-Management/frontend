'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TagService, type TagWithCount } from '../services/tag.service';

export const tagKeys = {
  all: ['tags'] as const,
  list: (workspaceId: string) => [...tagKeys.all, workspaceId] as const,
};

export function useTags(workspaceId: string) {
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: tagKeys.list(workspaceId),
    queryFn: () => TagService.list(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, color, type }: { name: string; color?: string; type?: string }) =>
      TagService.create(workspaceId, name, color, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) });
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
    mutationFn: (tagId: string) => TagService.delete(workspaceId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) });
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
    mutationFn: () => TagService.deleteAutomatic(workspaceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) });
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
      TagService.assignToItem(workspaceId, tagId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ tagId, itemId }: { tagId: string; itemId: string }) =>
      TagService.removeFromItem(workspaceId, tagId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) });
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