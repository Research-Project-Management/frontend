'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspaces/shell';

import { useCollections } from '../data/use-collections';
import { usePapers } from '../data/use-papers';
import { usePdf } from './use-pdf';
import { reindexPaper } from '../../services/paper.service';
import type { ReaderPanel } from '../../types/reader.types';

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 560;
const DEFAULT_PANEL_WIDTH = 400;

export function useReader() {
  const { workspaceId: workspaceUrl, paperId } = useParams() as { workspaceId: string; paperId: string };
  const router = useRouter();
  const qc = useQueryClient();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? '';

  const paperService = usePapers({ workspaceId, collectionId: '' });
  const papers = paperService.state.allPapers;
  const isLoadingPapers = paperService.state.isLoadingAll;
  const collectionService = useCollections(workspaceId);

  const collections = collectionService.state.collections;

  const paper = papers?.find((p: any) => p._id === paperId) ?? null;

  const collectionMap = useMemo(
    () => Object.fromEntries((collections ?? []).map((collection) => [collection._id, collection])),
    [collections],
  );
  const paperCollection = paper?.collectionId ? collectionMap[paper.collectionId] ?? null : null;
  const paperUrl = paper?.fileUrl || '';
  const { blobUrl: pdfBlobUrl, isLoading: pdfLoading, error: pdfError } = usePdf(paperUrl || null);

  const [activePanel, setActivePanel] = useState<ReaderPanel | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('flux_reader_active_panel');
    return saved === 'ai' || saved === 'details' || saved === 'notes' ? saved : null;
  });

  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
    const saved = localStorage.getItem('flux_reader_panel_width');
    return saved ? Number(saved) || DEFAULT_PANEL_WIDTH : DEFAULT_PANEL_WIDTH;
  });

  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [selectionContext, setSelectionContext] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!paper || paper.ragStatus !== 'pending') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['library-all-papers', workspaceId] });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper, workspaceId, qc]);

  useEffect(() => {
    setDraftTitle(paper?.title || '');
    setIsEditingTitle(false);
    setBibtexOpen(false);
  }, [paper?._id, paper?.title]);

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
    setActivePanel((current: any) => (current === panel ? null : panel));
  };


  const handleAskAi = (text: string) => {
    setSelectionContext(text);
    setActivePanel('ai');
  };

  const clearSelectionContext = () => setSelectionContext('');

  const handleReindex = async () => {
    if (!workspaceId || !paperId) return;
    setIsReindexing(true);
    try {
      await reindexPaper(workspaceId, paperId);
      toast.success('AI indexing started');
      qc.invalidateQueries({ queryKey: ['library-all-papers', workspaceId] });
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

    paperService.actions.updatePaper(
      { paperId: paper._id, title: nextTitle },
      {
        onSuccess: () => {
          setIsEditingTitle(false);
          toast.success('Paper title updated');
        },
        onError: () => {
          setDraftTitle(paper.title);
          toast.error('Could not update paper title');
        },
      },
    );
  };

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = panelWidth;
    setIsResizingPanel(true);
  };

  return {
    state: {
      workspaceId,
      workspaceUrl,
      paperId,
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
      clearSelectionContext,
      handleReindex,
      handleTitleSave,
      handleResizeMouseDown,
      navigate: router.push,
      goBack: () => router.back(),
    },
  };
}
