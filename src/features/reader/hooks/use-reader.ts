'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from "@/shared/lib/utils";
import { usePdf } from './use-pdf';
import { ItemsService } from '../services/items.service';
import { ReadingService, StateService } from '../services/state.service';
import { AnnotationsService } from '../services/annotations.service';
import { readerAnnotationKeys, useAnnotations } from './use-annotations';
import { useLibraryReaderStore } from '../store/reader.store';
import type { ReaderPanel, ReaderDocument, AnnotationRect, ReaderNavigationTarget } from '../types/reader.types';

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 560;
const DEFAULT_PANEL_WIDTH = 400;

export function useReader(overridePaperId?: string | null, onBackOverride?: () => void) {
  const params = useParams() as { paperId?: string; projectId?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const rawProjectId = params?.projectId;
  const isProject = Boolean(
    rawProjectId &&
      rawProjectId !== 'me' &&
      rawProjectId !== 'user' &&
      rawProjectId !== 'personal',
  );
  const scopeId = isProject ? rawProjectId! : 'user';

  const storeReadingId = useLibraryReaderStore((s) => s.readingPaperId);
  const closeReader = useLibraryReaderStore((s) => s.closeReader);
  const effectivePaperId = overridePaperId || storeReadingId || params?.paperId || '';

  const paperQuery = useQuery({
    queryKey: ['reader', 'item', scopeId, effectivePaperId],
    queryFn: () => ItemsService.getItem(scopeId, effectivePaperId),
    enabled: Boolean(effectivePaperId),
  });
  const paper = (paperQuery.data ?? null) as ReaderDocument | null;
  const isLoadingPapers = paperQuery.isLoading;

  const fulltextQuery = useQuery({
    queryKey: ['reader', 'fulltext', scopeId, effectivePaperId],
    queryFn: () => ItemsService.getFulltext(scopeId, effectivePaperId),
    enabled: Boolean(effectivePaperId),
  });
  const fulltext = fulltextQuery.data ?? null;
  const isLoadingFulltext = fulltextQuery.isLoading;

  const paperUrl = ItemsService.getPaperFileUrl(paper as any);
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: handleRetryPdf,
  } = usePdf(paperUrl || null);

  const [activePanel, setActivePanel] = useState<ReaderPanel | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flux_reader_active_panel');
      if (saved === 'ai' || saved === 'details' || saved === 'notes' || saved === 'annotations' || saved === 'cite') {
        setActivePanel(saved as ReaderPanel);
      }
    }
  }, []);

  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isWidthLoadedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flux_reader_panel_width');
      if (saved) {
        const width = Number(saved);
        if (width >= MIN_PANEL_WIDTH && width <= MAX_PANEL_WIDTH) {
          setPanelWidth(width);
        }
      }
      isWidthLoadedRef.current = true;
    }
  }, []);

  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
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
  } = useAnnotations(scopeId, effectiveAttachmentId);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!paper || paper.ragStatus !== 'pending') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['reader', 'item', scopeId, effectivePaperId] });
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

    ReadingService.getState(scopeId, paper.id)
      .then((stateData) => {
        if (stateData?.currentPage && stateData.currentPage > 1) {
          setTargetPage({ pageNumber: stateData.currentPage, timestamp: Date.now() });
          setVisiblePage(stateData.currentPage);
        }
      })
      .catch(() => {});
  }, [paper?.id, scopeId]);

  // Debounced update reading state when page changes
  useEffect(() => {
    if (!paper?.id || visiblePage <= 1) return;
    const timeout = setTimeout(() => {
      ReadingService.updateState(scopeId, paper.id, {
        currentPage: visiblePage,
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [visiblePage, paper?.id, scopeId]);

  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      markedPaperIdRef.current = paper.id;
      ReadingService.markAsRead(scopeId || 'me', paper.id).catch(() => {});
    }
  }, [scopeId, paper?.id]);

  useEffect(() => {
    setBibtexOpen(false);
  }, [paper?.id]);

  useEffect(() => {
    if (activePanel) localStorage.setItem('flux_reader_active_panel', activePanel);
  }, [activePanel]);

  useEffect(() => {
    if (!isWidthLoadedRef.current) return;
    localStorage.setItem('flux_reader_panel_width', String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - startXRef.current;
      const width = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(MAX_PANEL_WIDTH, startWidthRef.current - deltaX),
      );
      setPanelWidth(width);
    };

    const handleMouseUp = () => setIsResizingPanel(false);
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
    };
  }, [isResizingPanel]);

  const handlePanelToggle = (panel: ReaderPanel) => {
    setActivePanel((current: ReaderPanel | null) => (current === panel ? null : panel));
  };

  const handleAskAi = (text: string) => {
    setSelectionContext(text);
    setActivePanel('ai');
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
      const creators = paper?.creators || [];
      const firstAuthor =
        creators[0]?.lastName ||
        creators[0]?.fullName?.split(' ').slice(-1)[0] ||
        'Unknown';
      const year = paper?.year || 'n.d.';
      const authorCitation =
        creators.length > 1 ? `${firstAuthor} et al., ${year}` : `${firstAuthor}, ${year}`;
      const citationLabel = `(${authorCitation}, p. ${pageNumber})`;
      const backlink = effectiveAttachmentId
        ? `flux://open-pdf/library/items/${effectiveAttachmentId}?page=${pageNumber}&annotation=${annotationId || ''}`
        : `flux://open-pdf/library/items?page=${pageNumber}&annotation=${annotationId || ''}`;
      citationLink = `\n> — [${citationLabel}](${backlink})`;
    }

    const formatted = `> "${trimmed}"${citationLink}`;
    setPendingNoteText(formatted);
    setActivePanel('notes');
  };

  const handleAnnotate = async (
    text: string,
    pageNum?: number,
    colorHex: string = '#ffd400',
    rects?: AnnotationRect[],
    // Zotero 7 annotation types (no 'strike' — does not exist in Zotero 7)
    type: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area' = 'highlight',
  ) => {
    setActivePanel('annotations');
    if (!effectiveAttachmentId) return;

    const quote = text?.trim();
    if (!quote && type !== 'rect' && type !== 'area' && type !== 'text') return;

    try {
      const pageIndex = pageNum !== undefined && pageNum > 0 ? pageNum - 1 : 0;
      const effectiveType = type === 'area' ? 'rect' : type;
      await AnnotationsService.create(scopeId, effectiveAttachmentId, {
        type: effectiveType as any,
        pageIndex,
        color: colorHex,
        quoteText: quote || undefined,
        rects,
      });
      qc.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      });
      // Silent on success to keep academic reading flow distraction-free (Zotero parity)
    } catch (err) {
      console.error('Failed to create highlight annotation:', err);
      toast.error('Failed to save highlight', {
        description: getErrorMessage(err) || 'Could not save highlight. Please try again.',
        id: 'reader-annotation-toast',
      });
    }
  };

  const clearSelectionContext = () => setSelectionContext('');

  const handleReindex = async () => {
    if (!effectivePaperId) return;
    setIsReindexing(true);
    try {
      await ItemsService.reindexItem(scopeId, effectivePaperId);
      toast.success('AI indexing started', {
        description: 'Extracting semantic embeddings and citation links in background.',
        id: 'reader-ai-index',
      });
      qc.invalidateQueries({ queryKey: ['reader', 'item', scopeId, effectivePaperId] });
      setActivePanel('ai');
    } catch (err) {
      console.error('Reindex failed:', err);
      toast.error('Indexing failed', {
        description: 'Could not start AI indexing. Please try again.',
        id: 'reader-ai-index',
      });
    } finally {
      setIsReindexing(false);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (!paper || !effectivePaperId) return;
    const nextTitle = newTitle.trim();
    if (!nextTitle || nextTitle === paper.title) return;

    try {
      await ItemsService.updateItem(scopeId, paper.id, { title: nextTitle });
      qc.invalidateQueries({ queryKey: ['reader', 'item', scopeId, effectivePaperId] });
      toast.success('Paper title updated', { id: 'reader-title-update' });
    } catch (err: unknown) {
      toast.error('Failed to update title', {
        description: getErrorMessage(err) || 'Could not save the new paper title. Please try again.',
        id: 'reader-title-update',
      });
      throw err;
    }
  };

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = panelWidth;
    setIsResizingPanel(true);
  };

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
      // Find existing annotations to get version/pageIndex
      const existing = (qc.getQueryData(
        readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      ) || []) as any[];

      const upserts = Array.from(selectedAnnotationIds).map((id) => {
        const found = existing.find((a) => a.id === id);
        return {
          id,
          pageIndex: found?.pageIndex ?? 0,
          color: colorHex,
          expectedVersion: found?.version ?? 1,
        };
      });

      await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
        upserts,
        deletes: [],
      });

      qc.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      });
      toast.success(`Updated color for ${selectedAnnotationIds.size} highlights`, { id: 'reader-batch-action' });
      setSelectedAnnotationIds(new Set());
    } catch (err) {
      toast.error('Batch update failed', { description: getErrorMessage(err), id: 'reader-batch-action' });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!effectiveAttachmentId || selectedAnnotationIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const deletes = Array.from(selectedAnnotationIds);
      await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
        upserts: [],
        deletes,
      });

      qc.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
      });
      toast.success(`Deleted ${deletes.length} highlights`, { id: 'reader-batch-action' });
      setSelectedAnnotationIds(new Set());
    } catch (err) {
      toast.error('Batch delete failed', { description: getErrorMessage(err), id: 'reader-batch-action' });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchAddToNote = () => {
    if (!effectiveAttachmentId || selectedAnnotationIds.size === 0) return;
    const existing = (qc.getQueryData(
      readerAnnotationKeys.byAttachment(scopeId, effectiveAttachmentId),
    ) || []) as any[];

    const selected = existing.filter((a) => selectedAnnotationIds.has(a.id));
    const quotes = selected
      .map((a) => `> "${a.quoteText || ''}"\n\n— *Page ${(a.pageIndex ?? 0) + 1}*`)
      .join('\n\n---\n\n');

    setPendingNoteText(quotes);
    setActivePanel('notes');
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
      workspaceId: scopeId,
      workspaceUrl: scopeId,
      paperId: effectivePaperId,
      isLoadingPapers,
      paper,
      paperUrl,
      pdfBlobUrl,
      pdfLoading,
      pdfError,
      activePanel,
      panelWidth,
      isResizingPanel,
      isReindexing,
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
      setActivePanel,
      setBibtexOpen,
      handlePanelToggle,
      handleAskAi,
      handleAddToNote,
      handleAnnotate,
      handleNavigateToPage,
      handleNavigateToAnnotation,
      setPendingNoteText,
      clearSelectionContext,
      handleReindex,
      handleUpdateTitle,
      handleResizeMouseDown,
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
    },
  };
}
