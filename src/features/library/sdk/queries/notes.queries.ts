'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  NotesService,
  type CreateNoteDTO,
  type UpdateNoteDTO,
} from '../clients/notes.client';
import type { Note } from '@/features/library/types/core.types';
import {
  itemKeys,
  noteKeys,
  normalizeSpaceId,
  waitForBootstrapCache,
  getReaderBootstrapScope,
} from '@/features/library/sdk/query-keys';
import { invalidateLibraryCatalogDependencies } from './cache-patcher.queries';

export { noteKeys };


export function useNotes(spaceId?: string, itemId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  const cacheKey = noteKeys.list(effectiveScope, itemId);
  const notesQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      if (!itemId) return [];
      const seeded = await waitForBootstrapCache<Note[]>(
        queryClient,
        getReaderBootstrapScope(effectiveScope),
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return NotesService.list(effectiveScope, itemId);
    },
    enabled: !!itemId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDTO) =>
      NotesService.create(effectiveScope, {
        ...dto,
        itemId: dto.itemId !== undefined ? dto.itemId : itemId,
      }),
    onSuccess: (createdNote, dto) => {
      const targetItemId =
        (dto.itemId !== undefined ? dto.itemId : itemId) ?? undefined;
      if (createdNote && typeof createdNote === 'object' && 'id' in createdNote) {
        queryClient.setQueryData<Note[]>(
          noteKeys.list(effectiveScope, targetItemId),
          (old) => {
            const list = Array.isArray(old) ? old : [];
            if (list.some((n) => n.id === (createdNote as Note).id)) return list;
            return [createdNote as Note, ...list];
          },
        );
      }
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(effectiveScope, targetItemId),
      });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(effectiveScope) });
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemId: targetItemId,
        itemsList: true,
        counts: true,
      });
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
    }) => NotesService.update(effectiveScope, id, version, dto),
    onSuccess: (updatedNote, variables) => {
      queryClient.setQueryData<Note[]>(
        noteKeys.list(effectiveScope, itemId),
        (old) => {
          if (!Array.isArray(old)) return old;
          const serverPatch =
            updatedNote && typeof updatedNote === 'object'
              ? (updatedNote as Partial<Note>)
              : {};
          return old.map((n) =>
            n.id === variables.id
              ? {
                  ...n,
                  ...variables.dto,
                  ...serverPatch,
                  version:
                    typeof serverPatch.version === 'number'
                      ? serverPatch.version
                      : (n.version ?? variables.version) + 1,
                }
              : n,
          );
        },
      );
      queryClient.invalidateQueries({ queryKey: noteKeys.list(effectiveScope, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(effectiveScope) });
      if (itemId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(effectiveScope, itemId),
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
      NotesService.delete(effectiveScope, id, version),
    onMutate: async ({ id }) => {
      const listKey = noteKeys.list(effectiveScope, itemId);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousNotes = queryClient.getQueryData<Note[]>(listKey);
      if (Array.isArray(previousNotes)) {
        queryClient.setQueryData<Note[]>(
          listKey,
          previousNotes.filter((n) => n.id !== id),
        );
      }
      return { previousNotes };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(effectiveScope, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(effectiveScope) });
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemId,
        itemsList: true,
        counts: true,
      });
      toast.success('Note deleted', { id: 'note-mutation-toast' });
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousNotes !== undefined) {
        queryClient.setQueryData(
          noteKeys.list(effectiveScope, itemId),
          context.previousNotes,
        );
      }
      toast.error('Failed to delete note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const extractFromAnnotationsMutation = useMutation({
    mutationFn: (options?: {
      noteId?: string;
      attachmentId?: string;
      annotationIds?: string[];
      tagColor?: boolean | string;
      tagColorName?: string;
      includeComments?: boolean;
      protocol?: 'flux' | 'web';
      webBaseUrl?: string;
    }) => {
      if (!itemId) {
        return Promise.reject(new DOMException('itemId is required to extract annotations', 'InvalidStateError'));
      }
      return NotesService.extractFromAnnotations(effectiveScope, itemId, options);
    },
    onSuccess: (res: unknown) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(effectiveScope, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(effectiveScope) });
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemId,
        itemsList: true,
        counts: true,
      });
      const extractedInfo = res as {
        totalExtracted?: number;
        addedCount?: number;
        id?: string;
        note?: { id?: string };
        message?: string;
      } | null;
      const hasExtracted =
        extractedInfo &&
        (typeof extractedInfo.totalExtracted === 'number'
          ? extractedInfo.totalExtracted > 0
          : Boolean(extractedInfo.id || extractedInfo.note?.id));
      if (!hasExtracted) {
        toast.info('No PDF annotations found', {
          description: 'Highlight text or add annotations in the PDF reader first.',
          id: 'note-mutation-toast',
        });
      } else if (extractedInfo?.addedCount === 0) {
        toast.info('Literature note is already up to date', {
          description: 'All PDF highlights are already included in this note.',
          id: 'note-mutation-toast',
        });
      } else {
        toast.success(
          typeof extractedInfo?.addedCount === 'number' && extractedInfo.addedCount > 0
            ? `Added ${extractedInfo.addedCount} highlight(s) to Literature Note`
            : 'Compiled note from PDF annotations',
          {
            id: 'note-mutation-toast',
          },
        );
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
