'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { usePdf } from './use-pdf';
import { readerService, getItemFileUrl } from '@/features/library/sdk/library.client';
import {
  useReaderItem,
  useReaderFulltext,
  useAnnotations,
} from '@/features/library/sdk/queries/reader.queries';
import { annotationKeys } from '@/features/library/sdk/query-keys';
import { useReadingProgress } from './use-reading-progress';
import { useAnnotationBatch } from './use-annotation-batch';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type {
  ReaderDocument,
  AnnotationRect,
  ReaderNavigationTarget,
  AnnotationType,
} from '@/features/library/domain/types/reader.types';
import { formatAnnotationCitation } from '@/features/library/domain/reader.domain';

export function useReader(overridePaperId?: string | null, onBackOverride?: () => void) {
  const params = useParams() as { paperId?: string; projectId?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const rawProjectId = params?.projectId;
  const isProject = Boolean(
    rawProjectId && rawProjectId !== 'me' && rawProjectId !== 'user',
  );
  const scopeId = isProject ? rawProjectId! : 'user';

  const storeReadingId = useReaderStore((s) => s.readingPaperId);
  const closeReader = useReaderStore((s) => s.closeReader);
  const effectivePaperId = overridePaperId || storeReadingId || params?.paperId || '';

  const paperQuery = useReaderItem(scopeId, effectivePaperId);
  const paper = (paperQuery.data ?? null) as ReaderDocument | null;
  const isLoadingPapers = paperQuery.isLoading;

  const fulltextQuery = useReaderFulltext(scopeId, effectivePaperId);
  const fulltext = fulltextQuery.data ?? null;
  const isLoadingFulltext = fulltextQuery.isLoading;

  const paperUrl = getItemFileUrl(paper);
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: handleRetryPdf,
  } = usePdf(paperUrl || null);

  const [pendingNoteText, setPendingNoteText] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);
  const [targetPage, setTargetPage] = useState<ReaderNavigationTarget | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [visiblePage, setVisiblePage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);

  const effectiveAttachmentId =
    paper?.attachments?.[0]?.id || paper?.primaryFile?.fileId || undefined;

  const {
    annotations = [],
    updateAnnotation,
    deleteAnnotation,
    extractNotes,
    importExternal,
  } = useAnnotations(scopeId, effectiveAttachmentId);

  // Sub-hook 1: Reading progress restoration, debounced sync, markAsRead & RAG polling
  useReadingProgress({
    scopeId,
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
    undo: handleUndoAnnotation,
    redo: handleRedoAnnotation,
    canUndo,
    canRedo,
  } = useAnnotationBatch({
    scopeId,
    effectiveAttachmentId,
    paper,
    setPendingNoteText,
  });

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
      const trimmed = text.trim();
      if (!trimmed) return;

      let citationLink = '';
      if (pageNumber) {
        const cit = formatAnnotationCitation(
          paper,
          effectiveAttachmentId,
          pageNumber,
          annotationId,
        );
        citationLink = `\n> - ${cit.markdown}`;
      }

      const formatted = `> "${trimmed}"${citationLink}`;
      setPendingNoteText(formatted);
      useLibraryUIStore.getState().setIsInspectorOpen(true);
      useLibraryUIStore.getState().setActiveInspectorTab('notes');
    },
    [paper, effectiveAttachmentId],
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
        const created = await readerService.annotations.create(scopeId, effectiveAttachmentId, {
          type: effectiveType as AnnotationType,
          pageIndex,
          color: colorHex,
          quoteText: quote || undefined,
          comment: comment?.trim() || undefined,
          rects,
          tags: [],
        });
        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });
        return created;
      } catch (err) {
        toast.error('Failed to save annotation', {
          description: getErrorMessage(err) || 'Could not save annotation. Please try again.',
          id: 'reader-annotation-toast',
        });
      }
    },
    [effectiveAttachmentId, scopeId, qc],
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
      scopeId,
      projectId: isProject ? rawProjectId : undefined,
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
      effectiveAttachmentId,
      canUndo,
      canRedo,
    }),
    [
      scopeId,
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
      effectiveAttachmentId,
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
      updateAnnotation,
      deleteAnnotation,
      extractNotes,
      importExternal,
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
      updateAnnotation,
      deleteAnnotation,
      extractNotes,
      importExternal,
    ],
  );

  return useMemo(() => ({ state, actions }), [state, actions]);
}
