'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { usePdf } from './use-pdf';
import { readerService, getPaperFileUrl } from '@/features/library/data/reader/reader.service';
import { useReaderItem, useReaderFulltext } from '@/features/library/data/reader/reader.queries';
import { readerQueryKeys, readerAnnotationKeys } from '@/features/library/data/query-keys';
import { useAnnotations } from './use-annotations';
import { useLibraryReaderStore } from '@/features/library/store/reader.store';
import { useLibraryUIStore } from '@/features/library/store/library-ui.store';
import type {
  ReaderDocument,
  AnnotationRect,
  ReaderNavigationTarget,
  ReaderAnnotation,
  AnnotationType,
} from '@/features/library/types/reader.types';
import { formatAnnotationCitation, PdfAnnotationEngine } from '@/features/library/domain/reader.domain';

export function useReader(overridePaperId?: string | null, onBackOverride?: () => void) {
  const params = useParams() as { paperId?: string; projectId?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const rawProjectId = params?.projectId;
  const isProject = Boolean(
    rawProjectId && rawProjectId !== 'me' && rawProjectId !== 'user',
  );
  const scopeId = isProject ? rawProjectId! : 'user';

  const storeReadingId = useLibraryReaderStore((s) => s.readingPaperId);
  const closeReader = useLibraryReaderStore((s) => s.closeReader);
  const effectivePaperId = overridePaperId || storeReadingId || params?.paperId || '';

  const paperQuery = useReaderItem(scopeId, effectivePaperId);
  const paper = (paperQuery.data ?? null) as ReaderDocument | null;
  const isLoadingPapers = paperQuery.isLoading;

  const fulltextQuery = useReaderFulltext(scopeId, effectivePaperId);
  const fulltext = fulltextQuery.data ?? null;
  const isLoadingFulltext = fulltextQuery.isLoading;

  const paperUrl = getPaperFileUrl(paper);
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: handleRetryPdf,
  } = usePdf(paperUrl || null);

  const [selectionContext, setSelectionContext] = useState('');
  const [pendingNoteText, setPendingNoteText] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);
  const [targetPage, setTargetPage] = useState<ReaderNavigationTarget | null>(null);

  const effectiveAttachmentId =
    paper?.attachments?.[0]?.id || paper?.primaryFile?.fileId || undefined;

  const {
    annotations = [],
    updateAnnotation,
    deleteAnnotation,
    extractNotes,
    importExternal,
  } = useAnnotations(scopeId, effectiveAttachmentId);

  useEffect(() => {
    if (!paper || paper.ragStatus !== 'pending') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: readerQueryKeys.item(scopeId, effectivePaperId) });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper, scopeId, effectivePaperId, qc]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [visiblePage, setVisiblePage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Restore reading state on paper load
  const hasRestoredPageRef = useRef(false);
  useEffect(() => {
    if (!paper?.id || hasRestoredPageRef.current) return;
    hasRestoredPageRef.current = true;

    readerService.state
      .getState(scopeId, paper.id)
      .then((stateData) => {
        if (stateData?.currentPage && stateData.currentPage > 1) {
          setTargetPage({ pageNumber: stateData.currentPage, timestamp: Date.now() });
          setVisiblePage(stateData.currentPage);
        }
      })
      .catch(() => undefined);
  }, [paper?.id, scopeId]);

  // Debounced update reading state when page changes
  useEffect(() => {
    if (!paper?.id || visiblePage <= 1) return;
    const timeout = setTimeout(() => {
      readerService.state
        .updateState(scopeId, paper.id, {
          currentPage: visiblePage,
        })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(timeout);
  }, [visiblePage, paper?.id, scopeId]);

  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      markedPaperIdRef.current = paper.id;
      readerService.state.markAsRead(scopeId || 'me', paper.id).catch(() => undefined);
    }
  }, [scopeId, paper?.id]);

  useEffect(() => {
    setBibtexOpen(false);
  }, [paper?.id]);

  const handleAskAi = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSelectionContext(trimmed);
    useLibraryUIStore.getState().setIsInspectorOpen(true);
    useLibraryUIStore.getState().setActiveInspectorTab('ai');
  };

  const handleNavigateToAnnotation = (
    pageNumber: number,
    annotationId?: string,
    coords?: AnnotationRect,
  ) => {
    if (pageNumber >= 1) {
      setTargetPage({
        pageNumber,
        annotationId,
        coords,
        timestamp: Date.now(),
      });
    }
  };

  const handleNavigateToPage = (pageNumber: number) => {
    handleNavigateToAnnotation(pageNumber);
  };

  const handleAddToNote = (
    text: string,
    pageNumber?: number,
    annotationId?: string,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let citationLink = '';
    if (pageNumber) {
      const cit = formatAnnotationCitation(paper, effectiveAttachmentId, pageNumber, annotationId);
      citationLink = `\n> - ${cit.markdown}`;
    }

    const formatted = `> "${trimmed}"${citationLink}`;
    setPendingNoteText(formatted);
    useLibraryUIStore.getState().setIsInspectorOpen(true);
    useLibraryUIStore.getState().setActiveInspectorTab('notes');
  };

  const handleAnnotate = async (
    text: string,
    pageNum?: number,
    colorHex: string = '#ffd400',
    rects?: AnnotationRect[],
    type: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area' = 'highlight',
    comment?: string,
  ) => {
    if (!effectiveAttachmentId) return;

    const quote = text?.trim();
    if (!quote && type !== 'rect' && type !== 'area' && type !== 'text' && type !== 'note') return;

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
        queryKey: readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      });
      return created;
    } catch (err) {
      toast.error('Failed to save annotation', {
        description: getErrorMessage(err) || 'Could not save annotation. Please try again.',
        id: 'reader-annotation-toast',
      });
    }
  };

  const clearSelectionContext = () => setSelectionContext('');

  const handleToggleSelectAnnotation = (id: string) => {
    setSelectedAnnotationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchChangeColor = async (colorHex: string) => {
    if (!effectiveAttachmentId || selectedAnnotationIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const existing =
        qc.getQueryData<ReaderAnnotation[]>(
          readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        ) || [];

      const upserts = Array.from(selectedAnnotationIds).map((id) => {
        const found = existing.find((a) => a.id === id);
        return {
          id,
          pageIndex: found?.pageIndex ?? 0,
          color: colorHex,
          expectedVersion: found?.version ?? 1,
        };
      });

      await readerService.annotations.batch(scopeId, effectiveAttachmentId, {
        upserts,
        deletes: [],
      });

      qc.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      });
      toast.success(`Updated color for ${selectedAnnotationIds.size} highlights`, {
        id: 'reader-batch-action',
      });
      setSelectedAnnotationIds(new Set());
    } catch (err) {
      toast.error('Batch update failed', {
        description: getErrorMessage(err),
        id: 'reader-batch-action',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!effectiveAttachmentId || selectedAnnotationIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const deletes = Array.from(selectedAnnotationIds);
      await readerService.annotations.batch(scopeId, effectiveAttachmentId, {
        upserts: [],
        deletes,
      });

      qc.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      });
      toast.success(`Deleted ${deletes.length} highlights`, { id: 'reader-batch-action' });
      setSelectedAnnotationIds(new Set());
    } catch (err) {
      toast.error('Batch delete failed', {
        description: getErrorMessage(err),
        id: 'reader-batch-action',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchAddToNote = () => {
    if (!effectiveAttachmentId || selectedAnnotationIds.size === 0) return;
    const existing =
      qc.getQueryData<ReaderAnnotation[]>(
        readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      ) || [];

    const selected = PdfAnnotationEngine.sortAnnotationsInReadingOrder(
      existing.filter((a) => selectedAnnotationIds.has(a.id)),
    );
    const quotes = PdfAnnotationEngine.synthesizeMarkdownNote(
      selected,
      paper,
      effectiveAttachmentId,
    );

    setPendingNoteText(quotes);
    useLibraryUIStore.getState().setIsInspectorOpen(true);
    useLibraryUIStore.getState().setActiveInspectorTab('notes');
    setSelectedAnnotationIds(new Set());
    toast.success(`Added ${selected.length} highlights to Note draft`, { id: 'reader-note-toast' });
  };

  const goBack = () => {
    if (onBackOverride) {
      onBackOverride();
      return;
    }
    closeReader();
    router.push('/library');
  };

  return {
    state: {
      scopeId,
      projectId: isProject ? rawProjectId : undefined,
      paperId: effectivePaperId,
      isLoadingPapers,
      paper,
      paperUrl,
      pdfBlobUrl,
      pdfLoading,
      pdfError,
      selectionContext,
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
    },
    actions: {
      setBibtexOpen,
      handleAskAi,
      handleAddToNote,
      handleAnnotate,
      handleNavigateToPage,
      handleNavigateToAnnotation,
      setPendingNoteText,
      clearSelectionContext,
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
      updateAnnotation,
      deleteAnnotation,
      extractNotes,
      importExternal,
    },
  };
}
