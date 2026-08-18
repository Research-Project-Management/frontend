'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';

import { useCollections } from '../data/use-collections';
import { usePapers, usePaper } from '../data/use-papers';
import { usePdf } from './use-pdf';
import { reindexPaper, paperKeys } from '../../services/paper.service';
import { getPaperFileUrl } from '../../utils/library.util';
import { useLibraryReaderStore } from '../../store/reader.store';
import type { ReaderPanel } from '../../types/reader.types';
import type { Paper } from '../../types/library.types';

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

  const paperQuery = usePaper(workspaceId, effectivePaperId);
  const paper = paperQuery.data ?? null;
  const isLoadingPapers = paperQuery.isLoading;

  const { actions: paperActions } = usePapers({ workspaceId, collectionId: '' });
  const collectionService = useCollections(workspaceId);
  const collections = collectionService.state.collections;

  const collectionMap = useMemo(
    () => Object.fromEntries((collections ?? []).map((collection) => [collection.id, collection])),
    [collections],
  );
  const paperCollection = paper?.collectionId ? collectionMap[paper.collectionId] ?? null : null;
  const paperUrl = getPaperFileUrl(paper);
  const { blobUrl: pdfBlobUrl, isLoading: pdfLoading, error: pdfError } = usePdf(
    paperUrl || null,
    paper
      ? {
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          journal: paper.journal || paper.publisher,
          doi: paper.doi,
          abstract: paper.abstract,
        }
      : undefined
  );

  const [activePanel, setActivePanel] = useState<ReaderPanel | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flux_reader_active_panel');
      if (saved === 'ai' || saved === 'details' || saved === 'notes') {
        setActivePanel(saved);
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!paper || paper.ragStatus !== 'pending') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper, workspaceId, qc]);

  useEffect(() => {
    setDraftTitle(paper?.title || '');
    setIsEditingTitle(false);
    setBibtexOpen(false);
  }, [paper?.id, paper?.title]);

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

  const clearSelectionContext = () => setSelectionContext('');

  const handleReindex = async () => {
    if (!workspaceId || !effectivePaperId) return;
    setIsReindexing(true);
    try {
      await reindexPaper(workspaceId, effectivePaperId);
      toast.success('AI indexing started');
      qc.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      setActivePanel('ai');
    } catch (err) {
      console.error('Reindex failed:', err);
      toast.error('Could not start AI indexing');
    } finally {
      setIsReindexing(false);
    }
  };

  const handleTitleSave = () => {
    if (!paper) return;
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === paper.title) {
      setDraftTitle(paper.title);
      setIsEditingTitle(false);
      return;
    }

    const pId = paper.id;
    if (!pId) return;

    paperActions.updatePaper({ paperId: pId, title: nextTitle })
      .then(() => {
        setIsEditingTitle(false);
        toast.success('Paper title updated');
      })
      .catch(() => {
        setDraftTitle(paper.title);
        toast.error('Could not update paper title');
      });
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
      paperCollection,
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
      isEditingTitle,
      draftTitle,
      bibtexOpen,
    },
    actions: {
      setActivePanel,
      setIsEditingTitle,
      setDraftTitle,
      setBibtexOpen,
      handlePanelToggle,
      handleAskAi,
      handleAddToNote,
      setPendingNoteText,
      clearSelectionContext,
      handleReindex,
      handleTitleSave,
      handleResizeMouseDown,
      navigate: router.push,
      goBack,
      closeReader,
    },
  };
}
