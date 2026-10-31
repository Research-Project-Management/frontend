'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemsService,
  TagsService,
  NotesService,
  type CreateNoteDTO,
  type UpdateNoteDTO,
} from '@/features/library/sdk';
import type { Item, Note } from '@/features/library/domain/types/core.types';
import {
  itemKeys,
  tagKeys,
  noteKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  chunkUniqueIds,
  invalidateLibraryCatalogDependencies,
  removeItemsFromScopeCaches,
} from './cache-patcher';

export { tagKeys, noteKeys };

// ── Trash & Bulk Item Lifecycle Queries ──────────────────────────────────────

export function useTrash(
  scopeId: string = 'user',
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  const trashQuery = useQuery({
    queryKey: itemKeys.trash(effectiveScope),
    queryFn: ({ signal }) =>
      ItemsService.getAll(effectiveScope, { view: 'trash' }, { signal }),
    enabled: (options?.enabled ?? true) && Boolean(scopeId),
    select: (data): Item[] => {
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data)) return data as Item[];
      return [];
    },
  });

  const trashItems: Item[] = trashQuery.data ?? [];

  const restoreMutation = useMutation({
    mutationFn: (itemId: string) => ItemsService.restore(effectiveScope, itemId),
    onSuccess: () => {
      toast.success('Item restored', {
        description: 'Item has been returned to your library.',
        id: 'trash-mutation-toast',
      });
      invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to restore item', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (itemId: string) => ItemsService.purge(effectiveScope, itemId),
    onSuccess: () => {
      toast.success('Permanently deleted', {
        description: 'The item and its attachments were permanently removed.',
        id: 'trash-mutation-toast',
      });
      invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete item', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      let targetItems = items;
      if (targetItems.length === 0) {
        const res = await ItemsService.getAll(effectiveScope, { view: 'trash' });
        targetItems = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
            ? (res as Item[])
            : [];
      }
      if (targetItems.length === 0) return 0;
      const ids = targetItems.map((item) => item.id).filter(Boolean);
      const chunks = chunkUniqueIds(ids, 100);
      if (chunks.length === 0) return 0;
      const results = await Promise.all(
        chunks.map((chunk) => ItemsService.bulkPurge(effectiveScope, chunk)),
      );
      return results.reduce(
        (sum, res, idx) => sum + (res?.count ?? chunks[idx].length),
        0,
      );
    },
    onSuccess: (count) => {
      toast.success('Trash emptied', {
        description: `Permanently removed ${count} item(s).`,
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
    },
    onError: (err: Error) => {
      toast.error('Failed to empty trash', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  return {
    trashItems,
    isLoading: trashQuery.isLoading,
    isError: trashQuery.isError,
    error: trashQuery.error,
    isRestoring: restoreMutation.isPending,
    isPurging: purgeMutation.isPending,
    isEmptyingTrash: emptyTrashMutation.isPending,
    refetch: trashQuery.refetch,
    restoreItem: restoreMutation.mutateAsync,
    purgeItem: purgeMutation.mutateAsync,
    emptyTrash: () => emptyTrashMutation.mutateAsync(trashItems),
  };
}

export function useDeleteLibraryItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      await Promise.all(
        chunks.map((chunk) =>
          chunk.length === 1 && chunks.length === 1
            ? ItemsService.delete(effectiveScope, chunk[0])
            : ItemsService.bulkTrash(effectiveScope, chunk),
        ),
      );
      return rawIds;
    },
    onSuccess: (ids) => {
      removeItemsFromScopeCaches(queryClient, effectiveScope, ids);
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      toast.success(
        ids.length === 1 ? 'Item moved to trash' : `Moved ${ids.length} items to trash`,
        { id: 'item-delete' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to delete items', {
        description: err.message || 'Please try again.',
        id: 'item-delete',
      });
    },
  });
}

export function useBatchRestoreItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      await Promise.all(
        chunks.map((chunk) =>
          chunk.length === 1 && chunks.length === 1
            ? ItemsService.restore(effectiveScope, chunk[0])
            : ItemsService.bulkRestore(effectiveScope, chunk),
        ),
      );
      return rawIds;
    },
    onSuccess: (ids) => {
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      toast.success(
        `Restored ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`,
        { id: 'item-restore' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to restore items', {
        description: err.message || 'Please try again.',
        id: 'item-restore',
      });
    },
  });
}

export const useRestoreLibraryItemsMutation = useBatchRestoreItemsMutation;

export function useBatchPurgeItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      await Promise.all(
        chunks.map((chunk) => ItemsService.bulkPurge(effectiveScope, chunk)),
      );
      return rawIds;
    },
    onSuccess: (ids) => {
      removeItemsFromScopeCaches(queryClient, effectiveScope, ids);
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      toast.success(
        `Permanently deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`,
        { id: 'item-purge' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to permanently delete items', {
        description: err.message || 'Please try again.',
        id: 'item-purge',
      });
    },
  });
}

export const usePurgeLibraryItemsMutation = useBatchPurgeItemsMutation;

// ── Tags Query Hooks ─────────────────────────────────────────────────────────

export function useTags(scopeId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

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
      shortcut,
    }: {
      name: string;
      color?: string;
      type?: string;
      shortcut?: number | null;
    }) => TagsService.create(effectiveScope, name, color, type, shortcut),
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

// ── Notes Query Hooks ────────────────────────────────────────────────────────

export function useNotes(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  const notesQuery = useQuery({
    queryKey: noteKeys.list(effectiveScope, itemId),
    queryFn: () => {
      if (!itemId) return [];
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
      const extractedInfo = res as { totalExtracted?: number; id?: string; note?: { id?: string }; message?: string } | null;
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

export function useExtractNotesFromAnnotationsMutation(
  scopeId?: string,
  itemId?: string,
) {
  const { extractFromAnnotations, isExtractingFromAnnotations } = useNotes(scopeId, itemId);
  return {
    mutateAsync: extractFromAnnotations,
    isPending: isExtractingFromAnnotations,
  };
}
