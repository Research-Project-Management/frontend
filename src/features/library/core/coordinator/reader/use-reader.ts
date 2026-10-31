'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { usePdf } from './use-pdf';
import { getItemFileUrl, isProjectScope } from '@/features/library/domain/item-url';
import {
  useReaderItem,
  useReaderFulltext,
  useAnnotations,
} from '@/features/library/sdk/queries/reader.queries';
import {
  annotationKeys,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import { useReadingProgress } from './use-reading-progress';
import { useAnnotationBatch } from './use-annotation-batch';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type {
  ReaderDocument,
  ReaderAnnotation,
  AnnotationRect,
  ReaderNavigationTarget,
  AnnotationType,
} from '@/features/library/domain/types/reader.types';
import { formatAnnotationCitation } from '@/features/library/domain/reader.domain';

export function useReader(overridePaperId?: string | null, onBackOverride?: () => void) {
  const params = useParams() as { paperId?: string; projectId?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const searchParams = useSearchParams();
  const queryProjectId = searchParams?.get('projectId') || undefined;
  const isProject =
    activeScope.type === 'project' || Boolean(params?.projectId) || Boolean(queryProjectId);
  const rawProjectId =
    params?.projectId ||
    queryProjectId ||
    (activeScope.type === 'project' ? activeScope.projectId || activeScope.id : undefined);
  const scopeId = normalizeScopeId(rawProjectId);

  const storeReadingId = useReaderStore((s) => s.readingPaperId);
  const closeReader = useReaderStore((s) => s.closeReader);
  const effectivePaperId = overridePaperId || params?.paperId || storeReadingId || '';

  const paperQuery = useReaderItem(scopeId, effectivePaperId);
  const paper = (paperQuery.data ?? null) as ReaderDocument | null;
  const isLoadingPapers = paperQuery.isLoading;

  const effectiveScopeId = useMemo(() => {
    if (isProjectScope(scopeId)) return scopeId;
    if (paper?.projectId && isProjectScope(String(paper.projectId))) {
      return String(paper.projectId);
    }
    return scopeId;
  }, [scopeId, paper?.projectId]);

  const fulltextQuery = useReaderFulltext(effectiveScopeId, effectivePaperId);
  const fulltext = fulltextQuery.data ?? null;
  const isLoadingFulltext = fulltextQuery.isLoading;

  const requestedAttachmentId = searchParams?.get('attachmentId') || undefined;

  const selectedAttachment = useMemo(() => {
    if (!paper?.attachments || paper.attachments.length === 0) return null;
    if (requestedAttachmentId) {
      const found = paper.attachments.find((a) => a.id === requestedAttachmentId);
      if (found) return found;
    }
    return (
      paper.attachments.find((a) => a.attachmentType === 'primary_pdf') ||
      paper.attachments[0] ||
      null
    );
  }, [paper?.attachments, requestedAttachmentId]);

  const effectiveAttachmentId = selectedAttachment?.id;

  const paperUrl = useMemo(() => {
    if (selectedAttachment) {
      const downloadUrl =
        (selectedAttachment as { fileUrl?: string; url?: string }).fileUrl ||
        selectedAttachment.url;
      if (downloadUrl) return downloadUrl;
    }
    return getItemFileUrl(paper, effectiveScopeId);
  }, [selectedAttachment, paper, effectiveScopeId]);

  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: handleRetryPdf,
  } = usePdf(paperUrl || null, effectiveScopeId);

  const [pendingNoteText, setPendingNoteText] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);
  const [targetPage, setTargetPage] = useState<ReaderNavigationTarget | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [visiblePage, setVisiblePage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);

  const {
    annotations = [],
    isLoading: isLoadingAnnotations,
    isError: isAnnotationsError,
    refetch: refetchAnnotations,
    createAnnotation,
    updateAnnotation: rawUpdateAnnotation,
    deleteAnnotation: rawDeleteAnnotation,
    extractNotes,
    importExternal,
    isUpdating: isUpdatingAnnotation,
    isDeleting: isDeletingAnnotation,
    isExtracting: isExtractingNotes,
    isImporting: isImportingAnnotations,
  } = useAnnotations(effectiveScopeId, effectiveAttachmentId);

  // Sub-hook 1: Reading progress restoration, debounced sync & markAsRead
  useReadingProgress({
    scopeId: effectiveScopeId,
    paper,
    effectivePaperId,
    visiblePage,
    setVisiblePage,
    setTargetPage,
  });

  // Sub-hook 2: Multi-annotation selection & batch mutations
  const {
    selectedAnnotationIds,
    setSelectedAnnotationIds,
    isBatchProcessing,
    handleToggleSelectAnnotation,
    handleBatchChangeColor,
    handleBatchDelete,
    handleBatchAddToNote,
    pruneDeletedFromHistory,
    recordCreateAnnotation,
    recordUpdateAnnotation,
    recordSingleDeleteAnnotation,
    recordDeletedAnnotations,
    undo: handleUndoAnnotation,
    redo: handleRedoAnnotation,
    canUndo,
    canRedo,
  } = useAnnotationBatch({
    scopeId: effectiveScopeId,
    effectiveAttachmentId,
    paper,
    setPendingNoteText,
    extractNotes,
  });

  const updateAnnotation = useCallback(
    async (
      annotationId: string,
      expectedVersion: number | undefined,
      dto: {
        color?: string;
        comment?: string;
        quoteText?: string;
        tags?: string[];
        rects?: AnnotationRect[];
        boundingRect?: AnnotationRect;
      },
    ) => {
      const target = (annotations || []).find((a) => a.id === annotationId);
      const before: Partial<ReaderAnnotation> = target
        ? {
            ...(dto.color !== undefined ? { color: target.color } : {}),
            ...(dto.comment !== undefined ? { comment: target.comment ?? '' } : {}),
            ...(dto.quoteText !== undefined ? { quoteText: target.quoteText } : {}),
            ...(dto.tags !== undefined ? { tags: target.tags ?? [] } : {}),
            ...(dto.rects !== undefined ? { rects: target.rects } : {}),
            ...(dto.boundingRect !== undefined ? { boundingRect: target.boundingRect } : {}),
          }
        : {};
      const res = await rawUpdateAnnotation(annotationId, expectedVersion, dto);
      if (target && effectiveAttachmentId) {
        recordUpdateAnnotation({
          annotationId,
          attachmentId: effectiveAttachmentId,
          before,
          after: dto,
          version: (res as { version?: number } | undefined)?.version ?? target.version,
        });
      }
      return res;
    },
    [annotations, effectiveAttachmentId, rawUpdateAnnotation, recordUpdateAnnotation],
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string, expectedVersion?: number) => {
      const target = (annotations || []).find((a) => a.id === annotationId);
      pruneDeletedFromHistory([annotationId]);
      if (target) {
        recordSingleDeleteAnnotation(target);
      }
      return rawDeleteAnnotation(annotationId, expectedVersion);
    },
    [annotations, recordSingleDeleteAnnotation, rawDeleteAnnotation, pruneDeletedFromHistory],
  );

  useEffect(() => {
    setBibtexOpen(false);
  }, [paper?.id]);

  const handleNavigateToAnnotation = useCallback(
    (pageNumber: number, annotationId?: string, coords?: AnnotationRect) => {
      if (pageNumber >= 1) {
        setTargetPage({
          pageNumber,
          annotationId,
          coords,
          timestamp: Date.now(),
        });
      }
    },
    [],
  );

  const handleNavigateToPage = useCallback(
    (pageNumber: number) => {
      handleNavigateToAnnotation(pageNumber);
    },
    [handleNavigateToAnnotation],
  );

  const handleAddToNote = useCallback(
    (text: string, pageNumber?: number, annotationId?: string) => {
      if (annotationId && paper?.id && effectiveAttachmentId) {
        useLibraryUIStore.getState().setIsInspectorOpen(true);
        useLibraryUIStore.getState().setActiveInspectorTab('notes');
        void extractNotes(paper.id, {
          attachmentId: effectiveAttachmentId,
          annotationIds: [annotationId],
        });
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      let citationLink = '';
      if (pageNumber) {
        const cit = formatAnnotationCitation(
          paper,
          effectiveAttachmentId,
          pageNumber,
          annotationId,
          effectiveScopeId,
        );
        citationLink = `\n> - ${cit.markdown}`;
      }

      const formatted = `> "${trimmed}"${citationLink}`;
      setPendingNoteText(formatted);
      useLibraryUIStore.getState().setIsInspectorOpen(true);
      useLibraryUIStore.getState().setActiveInspectorTab('notes');
    },
    [paper, effectiveAttachmentId, effectiveScopeId, extractNotes],
  );

  const handleAnnotate = useCallback(
    async (
      text: string,
      pageNum?: number,
      colorHex: string = '#ffd400',
      rects?: AnnotationRect[],
      type: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area' = 'highlight',
      comment?: string,
    ) => {
      if (!effectiveAttachmentId) return;

      const quote = text?.trim();
      if (!quote && type !== 'rect' && type !== 'area' && type !== 'text' && type !== 'note') {
        return;
      }

      try {
        const pageIndex = pageNum !== undefined && pageNum > 0 ? pageNum - 1 : 0;
        const effectiveType = type === 'area' ? 'rect' : type;
        const created = await createAnnotation({
          type: effectiveType as AnnotationType,
          pageIndex,
          color: colorHex,
          quoteText: quote || undefined,
          comment: comment?.trim() || undefined,
          rects,
          tags: [],
        });
        if (created && typeof created === 'object' && 'id' in created) {
          recordCreateAnnotation(created as ReaderAnnotation, effectiveAttachmentId);
        }
        return created;
      } catch (err) {
        // Error toast already handled in useAnnotations createMutation
        if (!createAnnotation) {
          toast.error('Failed to save annotation', {
            description: getErrorMessage(err) || 'Could not save annotation. Please try again.',
            id: 'reader-annotation-toast',
          });
        }
      }
    },
    [effectiveAttachmentId, createAnnotation, recordCreateAnnotation],
  );

  const goBack = useCallback(() => {
    if (onBackOverride) {
      onBackOverride();
      return;
    }
    closeReader();
    router.push('/library');
  }, [onBackOverride, closeReader, router]);

  const state = useMemo(
    () => ({
      scopeId: effectiveScopeId,
      projectId: isProject ? rawProjectId : undefined,
      isProject,
      rawProjectId,
      paperId: effectivePaperId,
      isLoadingPapers,
      paper,
      paperUrl,
      pdfBlobUrl,
      pdfLoading,
      pdfError,
      pendingNoteText,
      bibtexOpen,
      fulltext,
      isLoadingFulltext,
      targetPage,
      isSidebarOpen,
      visiblePage,
      numPages,
      zoom,
      selectedAnnotationIds,
      isBatchProcessing,
      annotations: annotations || [],
      isLoadingAnnotations,
      isAnnotationsError,
      isUpdatingAnnotation,
      isDeletingAnnotation,
      isExtractingNotes,
      isImportingAnnotations,
      effectiveAttachmentId,
      selectedAttachment,
      canUndo,
      canRedo,
    }),
    [
      effectiveScopeId,
      isProject,
      rawProjectId,
      effectivePaperId,
      isLoadingPapers,
      paper,
      paperUrl,
      pdfBlobUrl,
      pdfLoading,
      pdfError,
      pendingNoteText,
      bibtexOpen,
      fulltext,
      isLoadingFulltext,
      targetPage,
      isSidebarOpen,
      visiblePage,
      numPages,
      zoom,
      selectedAnnotationIds,
      isBatchProcessing,
      annotations,
      isLoadingAnnotations,
      isAnnotationsError,
      isUpdatingAnnotation,
      isDeletingAnnotation,
      isExtractingNotes,
      isImportingAnnotations,
      effectiveAttachmentId,
      selectedAttachment,
      canUndo,
      canRedo,
    ],
  );

  const actions = useMemo(
    () => ({
      setBibtexOpen,
      handleAddToNote,
      handleAnnotate,
      handleNavigateToPage,
      handleNavigateToAnnotation,
      setPendingNoteText,
      handleRetryPdf,
      navigate: router.push,
      goBack,
      closeReader,
      setIsSidebarOpen,
      setVisiblePage,
      setNumPages,
      setZoom,
      setSelectedAnnotationIds,
      handleToggleSelectAnnotation,
      handleBatchChangeColor,
      handleBatchDelete,
      handleBatchAddToNote,
      handleUndoAnnotation,
      handleRedoAnnotation,
      recordCreateAnnotation,
      recordUpdateAnnotation,
      recordSingleDeleteAnnotation,
      recordDeletedAnnotations,
      updateAnnotation,
      deleteAnnotation,
      extractNotes,
      importExternal,
      refetchAnnotations,
    }),
    [
      handleAddToNote,
      handleAnnotate,
      handleNavigateToPage,
      handleNavigateToAnnotation,
      handleRetryPdf,
      router.push,
      goBack,
      closeReader,
      setSelectedAnnotationIds,
      handleToggleSelectAnnotation,
      handleBatchChangeColor,
      handleBatchDelete,
      handleBatchAddToNote,
      handleUndoAnnotation,
      handleRedoAnnotation,
      recordCreateAnnotation,
      recordUpdateAnnotation,
      recordSingleDeleteAnnotation,
      recordDeletedAnnotations,
      updateAnnotation,
      deleteAnnotation,
      extractNotes,
      importExternal,
      refetchAnnotations,
    ],
  );

  return useMemo(() => ({ state, actions }), [state, actions]);
}
