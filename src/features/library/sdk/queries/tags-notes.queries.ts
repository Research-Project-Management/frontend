'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  TagsService,
  NotesService,
  type CreateNoteDTO,
  type UpdateNoteDTO,
} from '../library.client';
import type { Note } from '@/features/library/domain/types/library.types';
import { itemKeys, tagKeys, noteKeys } from '@/features/library/sdk/query-keys';

export { tagKeys, noteKeys };

// TAGS QUERY HOOKS

export function useTags(scopeId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const tagsQuery = useQuery({
    queryKey: tagKeys.list(effectiveScope),
    queryFn: () => TagsService.list(effectiveScope),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({
      name,
      color,
      type,
    }: {
      name: string;
      color?: string;
      type?: string;
    }) => TagsService.create(effectiveScope, name, color, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag created', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create tag', {
        description: err.message || 'Please check the name and try again.',
        id: 'tag-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      tagId,
      data,
    }: {
      tagId: string;
      data: { name?: string; color?: string; type?: string; shortcut?: number | null };
    }) => TagsService.update(effectiveScope, tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag updated', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to update tag', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => TagsService.delete(effectiveScope, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag deleted', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete tag', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteAutomaticMutation = useMutation({
    mutationFn: () => TagsService.deleteAutomatic(effectiveScope),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success(`Removed ${data?.count ?? 0} automatic tag(s)`, {
        id: 'tag-mutation',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete automatic tags', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  return {
    tags: tagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    isError: tagsQuery.isError,
    error: tagsQuery.error,
    refetch: tagsQuery.refetch,
    createTag: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTag: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTag: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteAutomaticTags: deleteAutomaticMutation.mutateAsync,
    isDeletingAutomatic: deleteAutomaticMutation.isPending,
  };
}

// NOTES QUERY HOOKS

export function useNotes(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: noteKeys.list(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return NotesService.list(scopeId, itemId);
    },
    enabled: !!itemId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDTO) =>
      NotesService.create(scopeId, {
        ...dto,
        itemId: dto.itemId !== undefined ? dto.itemId : itemId,
      }),
    onSuccess: (_data, dto) => {
      const targetItemId =
        (dto.itemId !== undefined ? dto.itemId : itemId) ?? undefined;
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(scopeId, targetItemId),
      });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      if (targetItemId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(scopeId, targetItemId),
        });
      }
      toast.success('Note saved', { id: 'note-mutation-toast' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      version,
      dto,
    }: {
      id: string;
      version: number;
      dto: UpdateNoteDTO;
    }) => NotesService.update(scopeId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      if (itemId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(scopeId, itemId),
        });
      }
      toast.success('Note updated', { id: 'note-mutation-toast' });
    },
    onError: (err: Error) => {
      toast.error('Failed to update note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      NotesService.delete(scopeId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, itemId) });
      }
      toast.success('Note deleted', { id: 'note-mutation-toast' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const extractFromAnnotationsMutation = useMutation({
    mutationFn: (options?: {
      noteId?: string;
      tagColor?: boolean;
      includeComments?: boolean;
    }) => {
      if (!itemId) {
        throw new Error('itemId is required to extract annotations');
      }
      return NotesService.extractFromAnnotations(scopeId, itemId, options);
    },
    onSuccess: (res: unknown) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, itemId) });
      }
      const extractedInfo = res as { totalExtracted?: number; message?: string } | null;
      if (extractedInfo && extractedInfo.totalExtracted === 0) {
        toast.info('No PDF annotations found', {
          description: 'Highlight text or add annotations in the PDF reader first.',
          id: 'note-mutation-toast',
        });
      } else {
        toast.success('Compiled note from PDF annotations', {
          id: 'note-mutation-toast',
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Could not compile note from annotations', {
        description:
          err.message ||
          'Make sure this document has PDF highlights or annotations first.',
        id: 'note-mutation-toast',
      });
    },
  });

  return {
    notes: (notesQuery.data || []) as Note[],
    isLoading: notesQuery.isLoading,
    isError: notesQuery.isError,
    error: notesQuery.error,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isExtractingFromAnnotations: extractFromAnnotationsMutation.isPending,
    refetch: notesQuery.refetch,
    createNote: createMutation.mutateAsync,
    updateNote: (id: string, version: number, dto: UpdateNoteDTO) =>
      updateMutation.mutateAsync({ id, version, dto }),
    deleteNote: (id: string, version?: number) =>
      deleteMutation.mutateAsync({ id, version }),
    extractFromAnnotations: extractFromAnnotationsMutation.mutateAsync,
  };
}
