'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NoteService, NotesService, type CreateNoteDTO, type UpdateNoteDTO } from '../services/notes.service';
import type { Note } from '../types/library.types';
export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (scopeId?: string, itemId?: string) =>
    [...noteKeys.lists(), scopeId || 'default', itemId || 'all'] as const,
  detail: (scopeId?: string, id?: string) =>
    [...noteKeys.all, 'detail', scopeId || 'default', id] as const,
};

export function useNotes(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: noteKeys.list(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return NoteService.list(scopeId, itemId);
    },
    enabled: !!itemId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDTO) =>
      NoteService.create(scopeId, { ...dto, itemId: dto.itemId !== undefined ? dto.itemId : itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId) });
      toast.success('Note saved', { id: 'note-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to create note', {
        description: err?.message || 'Please try again.',
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
    }) => NoteService.update(scopeId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId) });
      toast.success('Note updated', { id: 'note-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to update note', {
        description: err?.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      NoteService.delete(scopeId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId) });
      toast.success('Note deleted', { id: 'note-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete note', {
        description: err?.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const state = {
    notes: (notesQuery.data || []) as Note[],
    isLoading: notesQuery.isLoading,
    isError: notesQuery.isError,
    error: notesQuery.error,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };

  const actions = {
    refetch: notesQuery.refetch,
    createNote: createMutation.mutateAsync,
    updateNote: (id: string, version: number, dto: UpdateNoteDTO) =>
      updateMutation.mutateAsync({ id, version, dto }),
    deleteNote: (id: string, version?: number) =>
      deleteMutation.mutateAsync({ id, version }),
  };

  return {
    state,
    actions,
    // Direct aliases for backwards compatibility
    ...state,
    ...actions,
  };
}
