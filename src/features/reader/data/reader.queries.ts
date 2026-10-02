/**
 * reader.queries.ts
 *
 * TANSTACK QUERY HOOKS FOR READER FEATURE & INSPECTOR
 * Completely self-contained, wrapping readerService directly.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { readerService } from './reader.service';
import { readerQueryKeys } from './query-keys';
import type {
  ReaderDocument,
  DocumentFulltext,
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  ReaderNote,
  CreateNoteDto,
  UpdateNoteDto,
  DocumentReadingState,
  ReaderCollection,
  DocumentTag,
  TagWithCount,
  DocumentAttachment,
  RelatedItem,
  CslStyleMetadata,
  SchemaItemTypeDefinition,
} from '../types/reader.types';
import { toast } from 'sonner';

// ── 1. Document Queries & Mutations ──────────────────────────────────────────

export function useReaderItem(
  scopeId: string | undefined,
  itemId: string | null | undefined,
  options?: Omit<UseQueryOptions<ReaderDocument, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: readerQueryKeys.item(scopeId, itemId || undefined),
    queryFn: () => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.documents.get(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

export function useUpdateReaderItem(scopeId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<ReaderDocument> }) =>
      readerService.documents.update(scopeId, itemId, data),
    onSuccess: (updatedItem, variables) => {
      queryClient.setQueryData(
        readerQueryKeys.item(scopeId, variables.itemId),
        updatedItem,
      );
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, variables.itemId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Update failed: ${error.message}`, { id: 'reader-item-update' });
    },
  });
}

export function useReaderFulltext(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.fulltext(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return null;
      return readerService.documents.getFulltext(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 10,
  });
}

// ── 2. Annotations Queries & Mutations ───────────────────────────────────────

export function useReaderAnnotations(scopeId?: string, attachmentId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.annotations(scopeId, attachmentId),
    queryFn: () => {
      if (!attachmentId) return [];
      return readerService.annotations.getByAttachment(scopeId, attachmentId);
    },
    enabled: Boolean(attachmentId),
    staleTime: 1000 * 30,
  });
}

export function useCreateReaderAnnotation(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateAnnotationDto) => {
      const targetAttachmentId = attachmentId || dto.attachmentId;
      if (!targetAttachmentId) throw new Error('Attachment ID is required');
      return readerService.annotations.create(scopeId, targetAttachmentId, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.annotations(scopeId, attachmentId),
      });
    },
  });
}

export function useUpdateReaderAnnotation(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, expectedVersion, dto }: { id: string; expectedVersion?: number; dto: UpdateAnnotationDto }) => {
      const targetAttachmentId = attachmentId || (dto as any).attachmentId;
      if (!targetAttachmentId) throw new Error('Attachment ID is required');
      return readerService.annotations.update(scopeId, targetAttachmentId, id, expectedVersion, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.annotations(scopeId, attachmentId),
      });
    },
  });
}

export function useDeleteReaderAnnotation(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (param: { id: string; expectedVersion?: number } | string) => {
      const id = typeof param === 'string' ? param : param.id;
      const expectedVersion = typeof param === 'object' ? param.expectedVersion : undefined;
      if (!attachmentId) throw new Error('Attachment ID is required');
      return readerService.annotations.delete(scopeId, attachmentId, id, expectedVersion);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.annotations(scopeId, attachmentId),
      });
    },
  });
}

export function useBatchReaderAnnotations(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (operations: {
      creates?: CreateAnnotationDto[];
      updates?: Array<UpdateAnnotationDto & { id: string }>;
      deletes?: string[];
    }) => {
      if (!attachmentId) throw new Error('attachmentId is required');
      return readerService.annotations.batch(scopeId, attachmentId, operations);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.annotations(scopeId, attachmentId),
      });
    },
  });
}

// ── 3. Notes Queries & Mutations ────────────────────────────────────────────

export function useReaderNotes(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.notes(scopeId, itemId),
    queryFn: () => readerService.notes.list(scopeId, itemId),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60,
  });
}

export function useCreateReaderNote(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateNoteDto) => readerService.notes.create(scopeId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.notes(scopeId, itemId),
      });
    },
  });
}

export function useUpdateReaderNote(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version, dto }: { id: string; version: number; dto: UpdateNoteDto }) =>
      readerService.notes.update(scopeId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.notes(scopeId, itemId),
      });
    },
  });
}

export function useDeleteReaderNote(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      readerService.notes.delete(scopeId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.notes(scopeId, itemId),
      });
    },
  });
}

export function useNotes(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const notesQuery = useReaderNotes(scopeId, itemId);

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDto) =>
      readerService.notes.create(scopeId, { ...dto, itemId: (dto as any).itemId !== undefined ? (dto as any).itemId : itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerQueryKeys.notes(scopeId, itemId) });
      toast.success('Note saved', { id: 'reader-note-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to create note', {
        description: err?.message || 'Please try again.',
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
      dto: UpdateNoteDto;
    }) => readerService.notes.update(scopeId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerQueryKeys.notes(scopeId, itemId) });
      toast.success('Note updated', { id: 'reader-note-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to update note', {
        description: err?.message || 'Please try again.',
        id: 'reader-note-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      readerService.notes.delete(scopeId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerQueryKeys.notes(scopeId, itemId) });
      toast.success('Note removed', { id: 'reader-note-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete note', {
        description: err?.message || 'Please try again.',
        id: 'reader-note-toast',
      });
    },
  });

  return {
    notes: notesQuery.data || [],
    isLoading: notesQuery.isLoading,
    createNote: (dto: CreateNoteDto) => createMutation.mutateAsync(dto),
    updateNote: (id: string, version: number, dto: UpdateNoteDto) =>
      updateMutation.mutateAsync({ id, version, dto }),
    deleteNote: (id: string, version?: number) =>
      deleteMutation.mutateAsync({ id, version }),
  };
}

// ── 4. Reading State Queries & Mutations ─────────────────────────────────────

export function useReaderState(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.state(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return null;
      return readerService.state.getState(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateReaderState(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
      currentPage?: number;
      scrollPosition?: Record<string, unknown> | Array<unknown> | null;
    }) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.state.updateState(scopeId, itemId, data);
    },
    onSuccess: (updatedState) => {
      queryClient.setQueryData(
        readerQueryKeys.state(scopeId, itemId),
        updatedState,
      );
    },
  });
}

// ── 5. Attachments Queries & Mutations ──────────────────────────────────────

export function useReaderAttachments(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.attachments(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return readerService.attachments.list(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateReaderAttachment(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      filename: string;
      url?: string;
      fileId?: string;
      contentType?: string;
      size?: number;
      isPrimary?: boolean;
    }) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.attachments.create(scopeId, itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

export function useDeleteReaderAttachment(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      readerService.attachments.delete(scopeId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

export function useSetPrimaryReaderAttachment(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.attachments.setPrimary(scopeId, itemId, attachmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

export function useRenameReaderAttachment(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attachmentId,
      filename,
      pattern,
    }: {
      attachmentId: string;
      filename?: string;
      pattern?: string;
    }) =>
      readerService.attachments.rename(scopeId, attachmentId, { filename, pattern }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: ['attachments'],
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      toast.success('File renamed', {
        description: res?.newFilename ? `Renamed to "${res.newFilename}"` : undefined,
        id: 'attachment-rename',
      });
    },
    onError: (err: any) => {
      toast.error('Failed to rename file', {
        description: err?.message || 'Please try again.',
        id: 'attachment-rename',
      });
    },
  });
}

// ── 6. Collections Queries & Mutations ──────────────────────────────────────

export function useReaderCollections(scopeId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.collections(scopeId),
    queryFn: () => readerService.collections.list(scopeId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useReaderItemCollections(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.itemCollections(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return readerService.collections.getItemCollections(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddToReaderCollection(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, itemIds }: { collectionId: string; itemIds: string[] }) =>
      readerService.collections.addToCollection(scopeId, collectionId, itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.itemCollections(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

export function useRemoveFromReaderCollection(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, itemIds }: { collectionId: string; itemIds: string[] }) =>
      readerService.collections.removeFromCollection(scopeId, collectionId, itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.itemCollections(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

// ── 7. Tags Queries & Mutations ─────────────────────────────────────────────

export function useReaderTags(scopeId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.tags(scopeId),
    queryFn: () => readerService.tags.list(scopeId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useReaderItemTags(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.itemTags(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return readerService.tags.getItemTags(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddTagToReaderItem(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tags: string[]) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.tags.addToItem(scopeId, itemId, tags);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.itemTags(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

export function useRemoveTagFromReaderItem(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tagIdOrName: string) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.tags.removeFromItem(scopeId, itemId, tagIdOrName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.itemTags(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
    },
  });
}

// ── 8. Relations Queries & Mutations ────────────────────────────────────────

export function useReaderRelations(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.relations(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return readerService.relations.list(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddReaderRelation(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetItemId, predicate }: { targetItemId: string; predicate?: string }) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.relations.add(scopeId, itemId, targetItemId, predicate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.relations(scopeId, itemId),
      });
    },
  });
}

export function useRemoveReaderRelation(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetItemId }: { targetItemId: string; predicate?: string }) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.relations.remove(scopeId, itemId, targetItemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.relations(scopeId, itemId),
      });
    },
  });
}

export function useRelations(scopeId?: string, itemId?: string) {
  const query = useReaderRelations(scopeId, itemId);
  const addMutation = useAddReaderRelation(scopeId, itemId);
  const removeMutation = useRemoveReaderRelation(scopeId, itemId);

  return {
    relatedItems: query.data || [],
    isLoading: query.isLoading,
    isLinking: addMutation.isPending || removeMutation.isPending,
    link: (targetItemId: string, predicate?: string) =>
      addMutation.mutateAsync({ targetItemId, predicate }),
    unlink: (targetItemId: string, predicate?: string) =>
      removeMutation.mutateAsync({ targetItemId, predicate }),
  };
}

export function useViewItems(scopeId?: string, _view = 'all') {
  return useQuery({
    queryKey: ['reader', 'view-items', scopeId || 'user'],
    queryFn: () => readerService.documents.getAll(scopeId),
    staleTime: 1000 * 60 * 2,
  });
}

// ── 9. Citations & CSL Queries ──────────────────────────────────────────────

export function useReaderCitation(scopeId?: string, itemId?: string, style = 'apa') {
  return useQuery({
    queryKey: readerQueryKeys.citation(scopeId, itemId, style),
    queryFn: () => {
      if (!itemId) return { citation: '', html: '' };
      return readerService.citations.format(scopeId, itemId, style);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useReaderBibtex(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.bibtex(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return { bibtex: '' };
      return readerService.citations.getBibtex(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useReaderCitationStyles(query?: string) {
  return useQuery({
    queryKey: readerQueryKeys.styles(query),
    queryFn: () => readerService.citations.getStyles(query),
    staleTime: 1000 * 60 * 30,
  });
}

// ── 10. Item Types & Schema Queries ─────────────────────────────────────────

export function useReaderItemTypes() {
  return useQuery({
    queryKey: readerQueryKeys.itemTypes(),
    queryFn: () => readerService.itemTypes.list(),
    staleTime: 1000 * 60 * 60,
  });
}

// ── 11. Type Conversion Hook ───────────────────────────────────────────────

export function useConversion(scopeId?: string) {
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      retainUnmappedInExtra = true,
    }: {
      itemId: string;
      targetType: string;
      retainUnmappedInExtra?: boolean;
    }) =>
      readerService.documents.previewConvertType(
        scopeId,
        itemId,
        targetType,
        retainUnmappedInExtra,
      ),
    onError: (err: any) => {
      toast.error('Preview failed', {
        description: err?.message || 'Failed to preview type conversion.',
        id: 'reader-type-conversion',
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      expectedVersion,
      retainUnmappedInExtra = true,
      silent = false,
    }: {
      itemId: string;
      targetType: string;
      expectedVersion?: number;
      retainUnmappedInExtra?: boolean;
      silent?: boolean;
    }) =>
      readerService.documents.convertType(
        scopeId,
        itemId,
        targetType,
        expectedVersion,
        retainUnmappedInExtra,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, variables.itemId),
      });
      if (!variables.silent) {
        toast.success('Item type converted', {
          description: variables.retainUnmappedInExtra
            ? 'Unmapped fields have been preserved in Extra.'
            : undefined,
          id: 'reader-type-conversion',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Conversion failed', {
        description: err?.message || 'Could not convert item type.',
        id: 'reader-type-conversion',
      });
    },
  });

  return {
    previewAsync: previewMutation.mutateAsync,
    convertAsync: convertMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    isConverting: convertMutation.isPending,
    previewData: previewMutation.data as any,
    conversionResult: convertMutation.data,
  };
}

// ── 12. Retraction Hook ─────────────────────────────────────────────────────

export function useRetraction(scopeId?: string) {
  const queryClient = useQueryClient();

  const checkItemMutation = useMutation({
    mutationFn: (itemId: string) => readerService.retraction.checkItem(scopeId, itemId),
    onSuccess: (data, itemId) => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      if (data.isRetracted) {
        toast.error('Retraction detected!', {
          description: `This publication was flagged as ${data.nature || 'retracted'}.`,
          id: 'reader-retraction-check',
        });
      } else {
        toast.success('Retraction check complete', {
          description: 'No retraction notices found for this item.',
          id: 'reader-retraction-check',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Check failed', { description: err?.message, id: 'reader-retraction-check' });
    },
  });

  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => readerService.retraction.unflagItem(scopeId, itemId),
    onSuccess: (_data, itemId) => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      toast.success('Retraction flag removed', { id: 'reader-retraction-unflag' });
    },
    onError: (err: any) => {
      toast.error('Failed to unflag item', {
        description: err?.message,
        id: 'reader-retraction-unflag',
      });
    },
  });

  return {
    checkItem: checkItemMutation.mutate,
    unflagItem: unflagMutation.mutate,
    isCheckingItem: checkItemMutation.isPending,
    isUnflagging: unflagMutation.isPending,
  };
}

// ── Ergonomic Aliases Matching Library Inspector Names ───────────────────────
export const useLibraryItemDetailQuery = useReaderItem;
export const useUpdateLibraryItemMutation = useUpdateReaderItem;
export function useAttachments(
  scopeIdOrOptions?: string | { scopeId?: string; projectId?: string },
  itemId?: string,
) {
  const scopeId = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');

  const queryClient = useQueryClient();

  const attachmentsQuery = useReaderAttachments(scopeId, itemId);

  const addMutation = useMutation({
    mutationFn: (data: Partial<DocumentAttachment> & { itemId?: string }) => {
      const targetItemId = data.itemId || itemId;
      if (!targetItemId) throw new Error('itemId is required');
      return readerService.attachments.create(scopeId, targetItemId, {
        filename: data.filename || 'attachment',
        url: data.url,
        fileId: data.fileId,
        contentType: data.mimeType || (data as any).contentType,
        size: data.size,
        isPrimary: data.isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      toast.success('Attachment added', { id: 'reader-attachment-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to add attachment', {
        description: err?.message || 'Please try again.',
        id: 'reader-attachment-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      readerService.attachments.delete(scopeId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      toast.success('Attachment deleted', { id: 'reader-attachment-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete attachment', {
        description: err?.message || 'Please try again.',
        id: 'reader-attachment-toast',
      });
    },
  });

  const captureSnapshotMutation = useMutation({
    mutationFn: (url?: string) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.attachments.captureSnapshot(scopeId, itemId, url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      toast.success('Web Snapshot captured', { id: 'reader-snapshot-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to capture snapshot', {
        description: err?.message || 'Please verify the URL is accessible.',
        id: 'reader-snapshot-toast',
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!itemId) throw new Error('itemId is required');
      return readerService.attachments.setPrimary(scopeId, itemId, attachmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.attachments(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: readerQueryKeys.item(scopeId, itemId),
      });
      toast.success('Set as primary document', { id: 'reader-primary-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to set primary document', {
        description: err?.message || 'Please try again.',
        id: 'reader-primary-toast',
      });
    },
  });

  return {
    ...attachmentsQuery,
    attachments: attachmentsQuery.data ?? [],
    add: addMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    captureSnapshot: captureSnapshotMutation.mutateAsync,
    setPrimary: setPrimaryMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCapturingSnapshot: captureSnapshotMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
    addAttachment: addMutation.mutateAsync,
    deleteAttachment: deleteMutation.mutateAsync,
    setPrimaryAttachment: setPrimaryMutation.mutateAsync,
  };
}

export const useItemAttachmentsQuery = useAttachments;
export const useItemAttachments = useAttachments;
export const useCreateAttachment = useCreateReaderAttachment;
export const useDeleteAttachment = useDeleteReaderAttachment;
export const useSetPrimaryAttachment = useSetPrimaryReaderAttachment;
export const useRenameAttachment = useRenameReaderAttachment;
export const useItemNotes = useReaderNotes;
export const useCreateNote = useCreateReaderNote;
export const useUpdateNote = useUpdateReaderNote;
export const useDeleteNote = useDeleteReaderNote;
export const useCollections = useReaderCollections;
export const useItemCollections = useReaderItemCollections;
export const useAddToCollection = useAddToReaderCollection;
export const useRemoveFromCollection = useRemoveFromReaderCollection;
export const useTags = useReaderTags;
export const useItemTags = useReaderItemTags;
export const useAddTagToItem = useAddTagToReaderItem;
export const useRemoveTagFromItem = useRemoveTagFromReaderItem;
export const useAddRelation = useAddReaderRelation;
export const useRemoveRelation = useRemoveReaderRelation;
export const useCslCitation = useReaderCitation;
export const useCitationStyles = useReaderCitationStyles;
export const useSearchCslStyles = useReaderCitationStyles;
export const useItemBibtex = useReaderBibtex;
export const useItemTypes = useReaderItemTypes;
export const useItemTypeConversion = useConversion;

export function useItemMetadataSourcesQuery(
  scopeId?: string | null,
  itemId?: string | null,
  options?: { enabled?: boolean },
) {
  const effectiveScope = scopeId || 'user';
  return useQuery({
    queryKey: readerQueryKeys.metadataSources(effectiveScope, itemId || undefined),
    queryFn: () => readerService.documents.getMetadataSources(effectiveScope, itemId!),
    enabled: !!itemId && (options?.enabled ?? true),
  });
}

// ── 13. PDF & OCR Action Hooks (Centralized Toasts) ──────────────────────────

export function useExportAnnotatedPdf(scopeId?: string) {
  const mutation = useMutation({
    mutationFn: async ({
      itemId,
      filename,
    }: {
      itemId: string;
      filename?: string;
    }) => {
      const targetFilename = filename || 'annotated-document.pdf';
      toast.loading('Exporting PDF with annotations...', { id: 'reader-export-annotated-pdf' });
      await readerService.citations.downloadAnnotatedPdf(scopeId, itemId, targetFilename);
      return targetFilename;
    },
    onSuccess: (filename) => {
      toast.success(`Annotated PDF exported: ${filename}`, { id: 'reader-export-annotated-pdf' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to export annotated PDF', {
        id: 'reader-export-annotated-pdf',
      });
    },
  });

  return {
    exportAnnotatedPdf: (itemId: string, filename?: string) =>
      mutation.mutateAsync({ itemId, filename }),
    isExporting: mutation.isPending,
  };
}

export function useOcrExtraction(scopeId?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!attachmentId) throw new Error('No attachment available to run OCR');
      toast.loading('Submitting OCR re-extraction job...', { id: 'reader-ocr-trigger' });
      await readerService.attachments.reExtract(scopeId, attachmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reader'] });
      toast.success('OCR job queued successfully', { id: 'reader-ocr-trigger' });
    },
    onError: (err: any) => {
      toast.error(`Failed to trigger OCR: ${err?.message || 'Unknown error'}`, {
        id: 'reader-ocr-trigger',
      });
    },
  });

  return {
    triggerOcr: (attachmentId: string) => mutation.mutateAsync(attachmentId),
    isTriggeringOcr: mutation.isPending,
  };
}


