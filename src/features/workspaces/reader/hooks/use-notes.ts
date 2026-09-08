'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import {
  NotesService,
  type CreateNoteDTO,
  type UpdateNoteDTO,
} from '../services/notes.service';
import type { ReaderNote } from '../types/reader.types';

export const readerNoteKeys = {
  all: ['reader', 'notes'] as const,
  list: (workspaceId: string, itemId?: string) =>
    [...readerNoteKeys.all, workspaceId, itemId || 'all'] as const,
  detail: (workspaceId: string, id: string) =>
    [...readerNoteKeys.all, 'detail', workspaceId, id] as const,
};

export function useNotes(workspaceId: string, itemId?: string) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: readerNoteKeys.list(workspaceId, itemId),
    queryFn: () => NotesService.list(workspaceId, itemId),
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDTO) =>
      NotesService.create(workspaceId, {
        ...dto,
        itemId: dto.itemId !== undefined ? dto.itemId : itemId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.list(workspaceId, itemId) });
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.list(workspaceId) });
      toast.success('Note saved', { id: 'reader-note-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to create note', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-note-toast',
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
    }) => NotesService.update(workspaceId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.list(workspaceId, itemId) });
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.list(workspaceId) });
      toast.success('Note updated', { id: 'reader-note-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to update note', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-note-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      NotesService.delete(workspaceId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.list(workspaceId, itemId) });
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.list(workspaceId) });
      toast.success('Note deleted', { id: 'reader-note-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to delete note', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-note-toast',
      });
    },
  });

  return {
    notes: (notesQuery.data || []) as ReaderNote[],
    isLoading: notesQuery.isLoading,
    isError: notesQuery.isError,
    error: notesQuery.error,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: notesQuery.refetch,
    createNote: createMutation.mutateAsync,
    updateNote: (id: string, version: number, dto: UpdateNoteDTO) =>
      updateMutation.mutateAsync({ id, version, dto }),
    deleteNote: (id: string, version?: number) =>
      deleteMutation.mutateAsync({ id, version }),
  };
}
