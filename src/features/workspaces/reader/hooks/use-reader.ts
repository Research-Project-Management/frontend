'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { usePdf } from './use-pdf';
import { ItemsService } from '../services/items.service';
import { ReadingService } from '../services/reading.service';
import { useLibraryReaderStore } from '../store/reader.store';
import type { ReaderPanel, ReaderDocument } from '../types/reader.types';

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 560;
const DEFAULT_PANEL_WIDTH = 400;

export function useReader(overridePaperId?: string | null, onBackOverride?: () => void) {
  const params = useParams() as { workspaceId?: string; paperId?: string };
  const workspaceUrl = params?.workspaceId || '';
  const router = useRouter();
  const qc = useQueryClient();
  const { workspace } = useWorkspace(workspaceUrl);
  const workspaceId = workspace?.id || workspaceUrl || '';

  const storeReadingId = useLibraryReaderStore((s) => s.readingPaperId);
  const closeReader = useLibraryReaderStore((s) => s.closeReader);
  const effectivePaperId = overridePaperId || storeReadingId || params?.paperId || '';

  const paperQuery = useQuery({
    queryKey: ['reader', 'item', workspaceId, effectivePaperId],
    queryFn: () => ItemsService.getItem(workspaceId, effectivePaperId),
    enabled: Boolean(workspaceId && effectivePaperId),
  });
  const paper = (paperQuery.data ?? null) as ReaderDocument | null;
  const isLoadingPapers = paperQuery.isLoading;

  const paperUrl = ItemsService.getPaperFileUrl(paper);
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
      if (saved === 'ai' || saved === 'details' || saved === 'notes' || saved === 'annotations') {
        setActivePanel(saved as ReaderPanel);
      }
    }
  }, []);

  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
    const saved = localStorage.getItem('flux_reader_panel_width');
    return saved ? Number(saved) || DEFAULT_PANEL_WIDTH : DEFAULT_PANEL_WIDTH;
  });

  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [selectionContext, setSelectionContext] = useState('');
  const [pendingNoteText, setPendingNoteText] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!paper || paper.ragStatus !== 'pending') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['reader', 'item', workspaceId, effectivePaperId] });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper, workspaceId, effectivePaperId, qc]);

  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (workspaceId && paper?.id && markedPaperIdRef.current !== paper.id) {
      markedPaperIdRef.current = paper.id;
      ReadingService.markAsRead(workspaceId, paper.id).catch(() => {});
    }
  }, [workspaceId, paper?.id]);

  useEffect(() => {
    setBibtexOpen(false);
  }, [paper?.id]);

  useEffect(() => {
    if (activePanel) localStorage.setItem('flux_reader_active_panel', activePanel);
  }, [activePanel]);

  useEffect(() => {
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

  const handleAddToNote = (text: string) => {
    setPendingNoteText(text);
    setActivePanel('notes');
  };

  const handleAnnotate = (_text: string, _pageNum?: number) => {
    setActivePanel('annotations');
  };

  const clearSelectionContext = () => setSelectionContext('');

  const handleReindex = async () => {
    if (!workspaceId || !effectivePaperId) return;
    setIsReindexing(true);
    try {
      await ItemsService.reindexItem(workspaceId, effectivePaperId);
      toast.success('AI indexing started', {
        description: 'Extracting semantic embeddings and citation links in background.',
        id: 'reader-ai-index',
      });
      qc.invalidateQueries({ queryKey: ['reader', 'item', workspaceId, effectivePaperId] });
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
    if (!paper || !workspaceId || !effectivePaperId) return;
    const nextTitle = newTitle.trim();
    if (!nextTitle || nextTitle === paper.title) return;

    try {
      await ItemsService.updateItem(workspaceId, paper.id, { title: nextTitle });
      qc.invalidateQueries({ queryKey: ['reader', 'item', workspaceId, effectivePaperId] });
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

  const goBack = () => {
    if (onBackOverride) {
      onBackOverride();
      return;
    }
    router.push(`/${workspaceUrl}/library`);
  };

  return {
    state: {
      workspaceId,
      workspaceUrl,
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
    },
    actions: {
      setActivePanel,
      setBibtexOpen,
      handlePanelToggle,
      handleAskAi,
      handleAddToNote,
      handleAnnotate,
      setPendingNoteText,
      clearSelectionContext,
      handleReindex,
      handleUpdateTitle,
      handleResizeMouseDown,
      handleRetryPdf,
      navigate: router.push,
      goBack,
      closeReader,
    },
  };
}
