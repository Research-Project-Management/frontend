'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { ItemsService } from '../clients/items.client';
import { AnnotationsService, normalizeAnnotationEntity } from '../clients/attachments-annotations.client';
import {
  NotesService,
  StateService,
  SearchService,
  type ExtractNotesOptions,
  type ItemStateData,
} from '../clients/catalog-entities.client';
import { fetchPdfBlob } from '../clients/http.client';

export type { ExtractNotesOptions, ItemStateData };

export function fetchReaderDocumentBlob(
  url: string,
  signal?: AbortSignal,
  options?: Parameters<typeof fetchPdfBlob>[2],
) {
  return fetchPdfBlob(url, signal, options);
}

export function fetchReaderItemState(scopeId: string | undefined, itemId: string) {
  return StateService.getState(scopeId, itemId);
}

export function updateReaderItemState(
  scopeId: string | undefined,
  itemId: string,
  payload: Parameters<typeof StateService.updateState>[2],
) {
  return StateService.updateState(scopeId, itemId, payload);
}

export function markReaderItemAsRead(scopeId: string | undefined, itemId: string) {
  return StateService.markAsRead(scopeId, itemId);
}

export function searchReaderAttachmentAnchors(
  attachmentId: string,
  query: string,
  pageIndex?: number,
  scopeId?: string,
  options?: { signal?: AbortSignal },
) {
  return SearchService.searchAnchors(attachmentId, query, pageIndex, scopeId, options);
}
import {
  itemKeys,
  readerQueryKeys,
  annotationKeys,
  noteKeys,
  relationKeys,
  normalizeScopeId,
  prepareBootstrapScope,
  registerBootstrapPromise,
  waitForBootstrapCache,
  getReaderBootstrapScope,
} from '@/features/library/sdk/query-keys';
import { useDownloadAnnotatedPdfMutation } from './extraction.queries';
import { invalidateLibraryCatalogDependencies } from './cache-patcher.queries';
import { PdfAnnotationEngine } from '@/features/library/domain/reader.domain';
import { buildClientAnnotationSortIndex } from '@/features/library/domain/reader-search-outline.domain';
import {
  ANNOTATION_HISTORY_HANDLERS,
  executeAnnotationBatchSync,
  pruneAnnotationHistoryEntry,
  runUndoAnnotationHistoryAction,
  runRedoAnnotationHistoryAction,
  executeAnnotationHistoryEntry,
  type UndoAction,
  type HistoryEntry,
  type AnnotationHistoryEntry,
  type AnnotationHistoryContext,
  type AnnotationHistoryStrategy,
} from './annotation-history.queries';
import type {
  AnnotationRect,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  ReaderAnnotation,
  ReaderDocument,
} from '@/features/library/types/reader.types';

type CreateAnnotationDTO = CreateAnnotationDto;
type UpdateAnnotationDTO = UpdateAnnotationDto & {
  rects?: AnnotationRect[];
  boundingRect?: AnnotationRect;
};

// ── 1. Document & Fulltext Queries ───────────────────────────────────────────

export function useReaderBootstrap(
  scopeId?: string,
  itemId?: string,
  attachmentId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const readerGateScope = getReaderBootstrapScope(targetScope);
  const bootstrapKey = readerQueryKeys.bootstrap(targetScope, itemId, attachmentId);
  const isEnabled = Boolean(itemId) && (options?.enabled ?? true);

  if (isEnabled && queryClient.getQueryData(bootstrapKey) === undefined) {
    prepareBootstrapScope(queryClient, readerGateScope);
  }

  return useQuery({
    queryKey: bootstrapKey,
    enabled: isEnabled,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 3 * 60 * 1000,
    queryFn: ({ signal }) =>
      registerBootstrapPromise(
        queryClient,
        readerGateScope,
        (async () => {
          if (!itemId || typeof ItemsService.getReaderBootstrap !== 'function') {
            return null;
          }
          try {
            const res = await ItemsService.getReaderBootstrap(
              targetScope,
              itemId,
              attachmentId,
              { signal },
            );
            if (!res || typeof res !== 'object') return null;

            const degradedBranches = Array.isArray(res.degradedBranches)
              ? res.degradedBranches
              : [];

            if (res.item) {
              queryClient.setQueryData(
                readerQueryKeys.item(targetScope, itemId),
                res.item as ReaderDocument,
              );
              const rawAttachments = Array.isArray(res.item.attachments)
                ? res.item.attachments
                : [];
              for (const att of rawAttachments) {
                const attRec = att as unknown as Record<string, unknown>;
                const attId =
                  typeof att.id === 'string'
                    ? att.id
                    : typeof attRec.attachmentId === 'string'
                      ? attRec.attachmentId
                      : undefined;
                if (attId && Array.isArray(attRec.annotations)) {
                  const normalizedAttAnns = (
                    attRec.annotations as Array<
                      ReaderAnnotation & { rectCoords?: unknown; quoteText?: string }
                    >
                  ).map(normalizeAnnotationEntity);
                  queryClient.setQueryData<ReaderAnnotation[]>(
                    annotationKeys.byAttachment(targetScope, attId),
                    normalizedAttAnns,
                  );
                }
              }
            }

            if (res.activeAttachmentId && Array.isArray(res.annotations)) {
              const normalizedActiveAnns = res.annotations.map(normalizeAnnotationEntity);
              queryClient.setQueryData<ReaderAnnotation[]>(
                annotationKeys.byAttachment(targetScope, res.activeAttachmentId),
                normalizedActiveAnns,
              );
            }

            if (res.fulltext !== undefined && !degradedBranches.includes('fulltext')) {
              queryClient.setQueryData(
                readerQueryKeys.fulltext(targetScope, itemId),
                res.fulltext,
              );
            }

            if (res.readingState) {
              queryClient.setQueryData(
                itemKeys.state(targetScope, itemId),
                res.readingState,
              );
            }

            if (Array.isArray(res.notes)) {
              queryClient.setQueryData(
                noteKeys.list(targetScope, itemId),
                res.notes,
              );
            }

            if (Array.isArray(res.relations)) {
              queryClient.setQueryData(
                relationKeys.all(targetScope, itemId),
                {
                  relatedItems: res.relations,
                  total: res.relations.length,
                },
              );
            }

            if (
              res.permissions &&
              !degradedBranches.includes('permissions') &&
              queryClient.getQueryData(itemKeys.counts(targetScope)) === undefined
            ) {
              queryClient.setQueryData(itemKeys.counts(targetScope), {
                total: 0,
                unfiled: 0,
                starred: 0,
                trash: 0,
                role: res.role,
                permissions: res.permissions,
              });
            }

            return res;
          } catch {
            // Graceful fallback: individual hooks (useReaderItem, useAnnotations, etc.) will fetch independently
            return null;
          }
        })(),
      ),
  });
}

export function useReaderItem(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const cacheKey = readerQueryKeys.item(targetScope, itemId);
  return useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      if (!itemId) return null;
      const seeded = await waitForBootstrapCache<ReaderDocument | null>(
        queryClient,
        getReaderBootstrapScope(targetScope),
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return (await ItemsService.getById(targetScope, itemId)) as ReaderDocument;
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
    gcTime: 3 * 60 * 1000,
  });
}

export function useReaderFulltext(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const cacheKey = readerQueryKeys.fulltext(targetScope, itemId);
  return useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      if (!itemId) return null;
      const seeded = await waitForBootstrapCache<
        Awaited<ReturnType<typeof ItemsService.getFulltext>>
      >(queryClient, getReaderBootstrapScope(targetScope), cacheKey);
      if (seeded !== undefined) return seeded;
      return ItemsService.getFulltext(targetScope, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 10,
    gcTime: 3 * 60 * 1000,
  });
}

// ── 2. Annotations Queries & Mutations ───────────────────────────────────────

export function useAnnotations(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const cacheKey = annotationKeys.byAttachment(targetScope, attachmentId);

  const query = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      if (!attachmentId) return [];
      const seeded = await waitForBootstrapCache<ReaderAnnotation[]>(
        queryClient,
        getReaderBootstrapScope(targetScope),
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return AnnotationsService.getByAttachment(targetScope, attachmentId);
    },
    enabled: Boolean(attachmentId),
    gcTime: 3 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateAnnotationDTO) => {
      if (!attachmentId) throw new Error('Attachment ID required to create annotation.');
      const id = dto.id || crypto.randomUUID();
      return AnnotationsService.create(scopeId, attachmentId, { ...dto, id });
    },
    onMutate: async (dto: CreateAnnotationDTO) => {
      if (!attachmentId) return undefined;
      const id = dto.id || crypto.randomUUID();
      const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
      await queryClient.cancelQueries({ queryKey });
      const previousAnnotations = queryClient.getQueryData<ReaderAnnotation[]>(queryKey);
      const firstRect = dto.rects?.[0];
      const optimisticAnnotation: ReaderAnnotation = {
        id,
        attachmentId,
        type: dto.type,
        pageIndex: dto.pageIndex,
        pageNumber: dto.pageNumber,
        pageLabel: dto.pageLabel ?? null,
        annotationSortIndex:
          dto.annotationSortIndex ??
          buildClientAnnotationSortIndex(
            dto.pageIndex ?? 0,
            firstRect?.y1 ?? dto.y ?? 0,
            firstRect?.x1 ?? dto.x ?? 0,
          ),
        color: dto.color,
        quoteText: dto.quoteText,
        comment: dto.comment,
        rects: dto.rects || [],
        boundingRect: dto.boundingRect,
        tags: dto.tags || [],
        version: 1,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old = []) => [
        ...old.filter((a) => a.id !== id),
        optimisticAnnotation,
      ]);
      return { previousAnnotations, optimisticId: id };
    },
    onSuccess: (created, _variables, context) => {
      const optimisticId = context?.optimisticId;
      if (attachmentId) {
        const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
        queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old = []) => {
          if (!created) return old;
          const targetId = optimisticId || created.id;
          if (old.some((a) => a.id === targetId || a.id === created.id)) {
            return old.map((a) => {
              if (a.id === targetId || a.id === created.id) {
                if (created.id !== targetId) {
                  return {
                    ...created,
                    color: a.color ?? created.color,
                    comment: a.comment ?? created.comment,
                    tags: a.tags && a.tags.length > 0 ? a.tags : created.tags,
                    rects: a.rects && a.rects.length > 0 ? a.rects : created.rects,
                  };
                }
                return created;
              }
              return a;
            });
          }
          return [...old, created];
        });
        queryClient.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
        });
      }
      toast.success('Annotation saved', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown, _variables, context) => {
      if (attachmentId) {
        const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
        if (context?.optimisticId) {
          queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old = []) =>
            old.filter((a) => a.id !== context.optimisticId),
          );
        } else if (context?.previousAnnotations !== undefined) {
          queryClient.setQueryData(queryKey, context.previousAnnotations);
        }
      }
      toast.error('Failed to create annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      annotationId,
      expectedVersion,
      dto,
    }: {
      annotationId: string;
      expectedVersion?: number;
      dto: UpdateAnnotationDTO;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID required to update annotation.');
      return AnnotationsService.update(
        scopeId,
        attachmentId,
        annotationId,
        expectedVersion,
        dto,
      );
    },
    onSuccess: (updatedAnnotation, variables) => {
      if (attachmentId) {
        const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
        queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old) => {
          if (!old) return old;
          return old.map((a) =>
            a.id === variables.annotationId
              ? updatedAnnotation ?? { ...a, ...variables.dto }
              : a,
          );
        });
      }
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
      });
      toast.success('Annotation updated', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to update annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({
      annotationId,
      expectedVersion,
    }: {
      annotationId: string;
      expectedVersion?: number;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID required to delete annotation.');
      return AnnotationsService.delete(
        scopeId,
        attachmentId,
        annotationId,
        expectedVersion,
      );
    },
    onMutate: async ({ annotationId }) => {
      if (!attachmentId) return { previousAnnotations: undefined };
      const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
      await queryClient.cancelQueries({ queryKey });
      const previousAnnotations =
        queryClient.getQueryData<ReaderAnnotation[]>(queryKey);
      if (previousAnnotations) {
        queryClient.setQueryData<ReaderAnnotation[]>(
          queryKey,
          previousAnnotations.filter((a) => a.id !== annotationId),
        );
      }
      return { previousAnnotations };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
      });
      toast.success('Annotation deleted', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown, _variables, context) => {
      if (attachmentId && context?.previousAnnotations !== undefined) {
        queryClient.setQueryData(
          annotationKeys.byAttachment(scopeId, attachmentId),
          context.previousAnnotations,
        );
      }
      toast.error('Failed to delete annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const extractNotesMutation = useMutation({
    mutationFn: (
      params:
        | string
        | {
            paperId: string;
            options?: ExtractNotesOptions;
          },
    ) => {
      const paperId = typeof params === 'string' ? params : params.paperId;
      const options = typeof params === 'string' ? undefined : params.options;
      return NotesService.extractFromAnnotations(scopeId, paperId, options);
    },
    onSuccess: (res, params) => {
      const paperId = typeof params === 'string' ? params : params.paperId;
      if (paperId) {
        queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, paperId) });
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, paperId) });
        queryClient.invalidateQueries({ queryKey: readerQueryKeys.item(scopeId, paperId) });
        invalidateLibraryCatalogDependencies(queryClient, normalizeScopeId(scopeId), {
          itemId: paperId,
          itemsList: true,
          counts: true,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      }
      const addedCount =
        (res as { addedCount?: number } | undefined)?.addedCount ?? res?.totalExtracted;
      if (!res || res.totalExtracted === 0) {
        toast.info('No annotations in this document to extract', {
          id: 'reader-annotation-toast',
        });
      } else if (addedCount === 0) {
        toast.info('Literature note is already up to date', {
          description: 'All annotations in this document have already been synthesized.',
          id: 'reader-annotation-toast',
        });
      } else {
        toast.success('Notes synthesized', {
          description: `Extracted ${addedCount ?? res.totalExtracted} highlight${(addedCount ?? res.totalExtracted) === 1 ? '' : 's'} into Literature Note.`,
          id: 'reader-annotation-toast',
        });
      }
    },
    onError: (err: unknown) => {
      toast.error('Failed to synthesize notes', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const importExternalMutation = useMutation({
    mutationFn: () => {
      if (!attachmentId) throw new Error('Attachment ID required to import annotations.');
      return AnnotationsService.importExternal(scopeId, attachmentId);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
      });
      const count =
        res?.importedCount ??
        (res as { imported?: number } | undefined)?.imported ??
        0;
      const totalFound =
        (res as { totalFound?: number } | undefined)?.totalFound ?? count;
      if (totalFound === 0 && count === 0) {
        toast.info('No embedded annotations found in PDF', {
          description: 'Scanned document pages and found 0 standard PDF annotations.',
          id: 'reader-annotation-toast',
        });
      } else if (count === 0 && totalFound > 0) {
        toast.info('Annotations already imported', {
          description: `All ${totalFound} embedded PDF annotation${totalFound === 1 ? '' : 's'} are already in your library.`,
          id: 'reader-annotation-toast',
        });
      } else {
        toast.success('Annotations imported', {
          description: `Imported ${count} annotation${count === 1 ? '' : 's'} from PDF.`,
          id: 'reader-annotation-toast',
        });
      }
    },
    onError: (err: unknown) => {
      toast.error('Failed to import annotations', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const annotations = useMemo(() => {
    return PdfAnnotationEngine.sortAnnotations(query.data || []);
  }, [query.data]);

  return {
    annotations,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createAnnotation: (dto: CreateAnnotationDTO) => {
      const id = dto.id || crypto.randomUUID();
      return createMutation.mutateAsync({ ...dto, id });
    },
    updateAnnotation: (
      annotationId: string,
      expectedVersion: number | undefined,
      dto: UpdateAnnotationDTO & {
        rects?: AnnotationRect[];
        boundingRect?: AnnotationRect;
      },
    ) => updateMutation.mutateAsync({ annotationId, expectedVersion, dto }),
    deleteAnnotation: (annotationId: string, expectedVersion?: number) =>
      deleteMutation.mutateAsync({ annotationId, expectedVersion }),
    extractNotes: (paperId: string, options?: ExtractNotesOptions) =>
      extractNotesMutation.mutateAsync({ paperId, options }),
    importExternal: importExternalMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isExtracting: extractNotesMutation.isPending,
    isImporting: importExternalMutation.isPending,
    refetch: query.refetch,
  };
}

// ── 3. PDF & OCR Action Hooks (Centralized Toasts) ───────────────────────────

export function useExportAnnotatedPdf(scopeId?: string) {
  const downloadMutation = useDownloadAnnotatedPdfMutation(scopeId);

  return {
    exportAnnotatedPdf: async (itemId: string, filename?: string, attachmentId?: string) => {
      const targetFilename = filename || 'annotated-document.pdf';
      toast.loading('Exporting PDF with annotations...', { id: 'reader-export-annotated-pdf' });
      try {
        await downloadMutation.mutateAsync({
          itemId,
          filename: targetFilename,
          attachmentId,
        });
        toast.success(`Annotated PDF exported: ${targetFilename}`, {
          id: 'reader-export-annotated-pdf',
        });
        return targetFilename;
      } catch (err: unknown) {
        toast.error(getErrorMessage(err) || 'Failed to export annotated PDF', {
          id: 'reader-export-annotated-pdf',
        });
        throw err;
      }
    },
    isExporting: downloadMutation.isPending,
  };
}

// ── 4. Annotation Batch & Undo/Redo History Transport (SDK Layer) ────────────

export async function executeExtractAnnotationNotes(
  scopeId: string,
  paperId: string,
  options?: Parameters<typeof AnnotationsService.extractNotes>[2],
  queryClient?: ReturnType<typeof useQueryClient>,
): Promise<unknown> {
  const res = await AnnotationsService.extractNotes(scopeId, paperId, options);
  if (queryClient && paperId) {
    const effectiveScope = normalizeScopeId(scopeId);
    void queryClient.invalidateQueries({ queryKey: noteKeys.list(effectiveScope, paperId) });
    void queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, paperId) });
  }
  return res;
}

export {
  ANNOTATION_HISTORY_HANDLERS,
  executeAnnotationBatchSync,
  pruneAnnotationHistoryEntry,
  runUndoAnnotationHistoryAction,
  runRedoAnnotationHistoryAction,
  executeAnnotationHistoryEntry,
  type UndoAction,
  type HistoryEntry,
  type AnnotationHistoryEntry,
  type AnnotationHistoryContext,
  type AnnotationHistoryStrategy,
};

