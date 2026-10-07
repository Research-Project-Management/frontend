'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from "@/shared/lib/utils";
import {
  Loader2,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { useReader } from '../hooks/use-reader';
import { useReaderStore } from '../store/reader.store';
import { useReaderUIStore } from '../store/reader-ui.store';
import { readerService } from '../data/reader.service';
import { useOcrExtraction, useExportAnnotatedPdf } from '../data/reader.queries';
import { ReaderInspector } from '../components/inspector';
import Topbar from '../components/Topbar';
import ReaderToolbar from '../components/ReaderToolbar';
import Sidebar from '../components/Sidebar';
import Systembar from '../components/Systembar';
import DocumentNavDrawer from '../components/viewer/DocumentNavDrawer';
import type { AnnotationRect } from '../types/reader.types';

const BibtexModal = dynamic(() => import('../components/modals/BibtexModal'), {
  ssr: false,
});

const Viewer = dynamic(() => import('../components/viewer/Viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-muted">
      <div className="flex flex-col gap-3 p-8 bg-card border border-border rounded-md animate-pulse select-none w-[600px] max-w-[90vw] h-[848px] max-h-[85vh]">
        <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
        <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
        <div className="space-y-2 flex-1">
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-11/12 bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-4/5 bg-muted rounded-sm" />
        </div>
      </div>
    </div>
  ),
});

export interface ReaderPageProps {
  paperId?: string | null;
  onBack?: () => void;
}

export default function ReaderPage({ paperId, onBack }: ReaderPageProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearchQuery = searchParams.get('q') || searchParams.get('search') || undefined;
  const { state, actions } = useReader(paperId, onBack);
  const {
    scopeId,
    projectId,
    isLoadingPapers,
    paper,
    paperUrl,
    pdfBlobUrl,
    pdfLoading,
    pdfError,
    activePanel,
    panelWidth,
    isResizingPanel,
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
    annotations = [],
    effectiveAttachmentId,
  } = state;

  const {
    setActivePanel,
    setBibtexOpen,
    handlePanelToggle,
    handleAskAi,
    handleAddToNote,
    handleAnnotate,
    handleNavigateToPage,
    setPendingNoteText,
    handleResizeMouseDown,
    handleRetryPdf,
    goBack,
    setIsSidebarOpen,
    setZoom,
    setSelectedAnnotationIds,
    handleToggleSelectAnnotation,
    handleBatchChangeColor,
    handleBatchDelete,
    handleBatchAddToNote,
    deleteAnnotation,
    updateAnnotation,
  } = actions;

  // Zotero-standard URL citation jumping: ?page=X&annotation=Y
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const annParam = searchParams.get('annotation') || undefined;
    if (pageParam) {
      const p = parseInt(pageParam, 10);
      if (!isNaN(p) && p >= 1) {
        actions.handleNavigateToAnnotation(p, annParam);
      }
    }
  }, [searchParams, actions]);

  // Zotero 7 Multi-Tab Store
  const {
    tabs,
    activeTabId,
    openReader,
    closeTab,
    setActiveTab,
    activeColor,
    setActiveColor,
    activeTool,
    setActiveTool,
  } = useReaderStore();

  // Reader Inspector UI Store
  const { isInspectorOpen, setIsInspectorOpen, setActiveInspectorTab, activeScope } = useReaderUIStore();

  const handleAskAiWithInspector = useCallback(
    (text: string) => {
      handleAskAi(text);
      setIsInspectorOpen(true);
      setActiveInspectorTab('ai');
      window.dispatchEvent(
        new CustomEvent('reader-ask-ai', { detail: { text } }),
      );
    },
    [handleAskAi, setIsInspectorOpen, setActiveInspectorTab],
  );

  // In-Document Search & Academic Entities Drawer
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(Boolean(initialSearchQuery));
  const [isEntitiesDrawerOpen, setIsEntitiesDrawerOpen] = useState<boolean>(false);

  // Page Presentation Mode (Zotero 7: Continuous Scroll, Single Page, Two Pages/Spread)
  const [viewMode, setViewMode] = useState<'single' | 'continuous' | 'spread'>('continuous');
  const [fitMode, setFitMode] = useState<'fit-width' | 'fit-page' | 'auto'>('fit-width');

  // Global keyboard shortcut: Ctrl+F / Cmd+F to toggle document search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Register opened paper into tab store
  useEffect(() => {
    if (paper?.id) {
      openReader(paper.id, paper.title || 'Untitled Document');
    }
  }, [paper?.id, paper?.title, openReader]);

  const handleSelectTab = (id: string) => {
    if (id === 'library') {
      goBack();
    } else {
      setActiveTab(id);
      router.push(`/library/papers/${id}`);
    }
  };

  const handleCloseTab = (id: string) => {
    closeTab(id);
    if (activeTabId === id || (paper && paper.id === id)) {
      const remaining = tabs.filter((t) => t.id !== id);
      const next = remaining[remaining.length - 1] || { id: 'library' };
      if (next.id === 'library') {
        goBack();
      } else {
        router.push(`/library/papers/${next.id}`);
      }
    }
  };

  // Additional Academic Reader States (Pan/Select, Rotation, Reading Theme, Split View, Reading Mode, Lock Tool)
  const [interactionMode, setInteractionMode] = useState<'select' | 'hand'>('select');
  const [rotation, setRotation] = useState<number>(0);
  const [themeMode, setThemeMode] = useState<'normal' | 'sepia' | 'dark'>('normal');
  const [splitMode, setSplitMode] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [isToolLocked, setIsToolLocked] = useState<boolean>(false);
  const [pageHistory, setPageHistory] = useState<number[]>([]);

  const handleNavigateToPageWithHistory = useCallback((newPage: number, annotationId?: string) => {
    if (visiblePage && visiblePage !== newPage) {
      setPageHistory((prev) => [...prev.slice(-30), visiblePage]);
    }
    if (actions.handleNavigateToAnnotation) {
      actions.handleNavigateToAnnotation(newPage, annotationId);
    } else {
      handleNavigateToPage(newPage);
    }
  }, [visiblePage, actions, handleNavigateToPage]);

  const handleNavigateBack = useCallback(() => {
    if (pageHistory.length === 0) return;
    const prevPage = pageHistory[pageHistory.length - 1];
    setPageHistory((prev) => prev.slice(0, prev.length - 1));
    handleNavigateToPage(prevPage);
  }, [pageHistory, handleNavigateToPage]);

  // Escape key exits distraction-free reading mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isReadingMode) {
        setIsReadingMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadingMode]);

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleToggleThemeMode = () => {
    setThemeMode((m) => (m === 'normal' ? 'sepia' : m === 'sepia' ? 'dark' : 'normal'));
  };

  const { triggerOcr } = useOcrExtraction(scopeId);

  const handleExtractAllAnnotationsToNote = async () => {
    if (!paper?.id) return;
    try {
      await actions.extractNotes(paper.id);
      setActivePanel('notes');
      setIsInspectorOpen(true);
    } catch {
      // Handled in hook toast
    }
  };

  // Zotero 7 behavior: If tool is not locked and is not 'select', revert back to 'select' after creating annotation
  const handleAnnotateWithLock = useCallback(
    async (
      text: string,
      pageNum?: number,
      colorHex?: string,
      rects?: AnnotationRect[],
      type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area',
      comment?: string,
    ) => {
      const res = await handleAnnotate(text, pageNum, colorHex, rects, type, comment);
      if (!isToolLocked && activeTool !== 'select') {
        setActiveTool('select');
      }
      return res;
    },
    [handleAnnotate, isToolLocked, activeTool, setActiveTool]
  );

  // Scanned document detection & OCR status
  const primaryAttachment = (paper?.attachments as any[])?.find(
    (a) => a.id === effectiveAttachmentId
  ) || (paper?.attachments as any[])?.[0];

  const isScanned = Boolean(
    (primaryAttachment?.metadata as any)?.isScanned ||
    (paper as any)?.metadata?.isScanned ||
    (fulltext && (!fulltext.sections || fulltext.sections.length === 0) && (!fulltext.abstract || fulltext.abstract.length === 0) && (numPages > 0))
  );

  const rawOcrStatus = (primaryAttachment?.extractionStatus?.toLowerCase() as any) ||
    (primaryAttachment?.metadata as any)?.ocrStatus ||
    (paper as any)?.metadata?.ocrStatus ||
    'none';

  const ocrStatus = (['pending', 'processing', 'ready', 'completed', 'none'].includes(rawOcrStatus)
    ? rawOcrStatus
    : 'none') as 'pending' | 'processing' | 'ready' | 'completed' | 'none';

  const handleTriggerOcr = useCallback(async () => {
    if (!effectiveAttachmentId) return;
    try {
      await triggerOcr(effectiveAttachmentId);
    } catch {
      // Handled by useOcrExtraction hook toast
    }
  }, [effectiveAttachmentId, triggerOcr]);

  const { exportAnnotatedPdf } = useExportAnnotatedPdf(scopeId || 'me');

  const handleExportAnnotatedPdf = useCallback(async () => {
    const currentPaperId = paper?.id || activeTabId;
    if (!currentPaperId || currentPaperId === 'library') return;
    try {
      await exportAnnotatedPdf(currentPaperId, `${paper?.title || 'document'}-annotated.pdf`);
    } catch {
      // Handled in useExportAnnotatedPdf hook toast
    }
  }, [paper, activeTabId, exportAnnotatedPdf]);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background ${isResizingPanel ? 'select-none' : ''}`}>
      {/* 1. ZOTERO 7 MULTI-PAPER TAB BAR (Row 1) - Hidden in Reading Mode */}
      {!isReadingMode && (
        <Topbar
          paper={paper}
          tabs={tabs}
          activeTabId={paper?.id || activeTabId}
          scopeTitle={activeScope}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onBack={goBack}
          onExportAnnotatedPdf={handleExportAnnotatedPdf}
          onPrint={handlePrint}
        />
      )}

      {/* 2. ZOTERO 7 DEDICATED READER TOOLBAR (Row 2) */}
      {paperUrl && (
        <ReaderToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          visiblePage={visiblePage}
          numPages={numPages}
          onNavigateToPage={handleNavigateToPageWithHistory}
          canNavigateBack={pageHistory.length > 0}
          onNavigateBack={handleNavigateBack}
          isReadingMode={isReadingMode}
          onToggleReadingMode={() => setIsReadingMode((v) => !v)}
          splitMode={splitMode}
          onSelectSplitMode={setSplitMode}
          interactionMode={interactionMode}
          onSelectInteractionMode={setInteractionMode}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          activeColor={activeColor}
          onSelectColor={setActiveColor}
          isToolLocked={isToolLocked}
          onToggleToolLocked={() => setIsToolLocked((v) => !v)}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
          onZoomOut={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
          onSetZoom={setZoom}
          onFitWidth={() => setZoom(1.0)}
          rotation={rotation}
          onRotate={handleRotate}
          themeMode={themeMode}
          onToggleThemeMode={handleToggleThemeMode}
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
          fitMode={fitMode}
          onSelectFitMode={setFitMode}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
          isEntitiesDrawerOpen={isEntitiesDrawerOpen}
          onToggleEntitiesDrawer={() => setIsEntitiesDrawerOpen((v) => !v)}
          onExtractToNote={handleExtractAllAnnotationsToNote}
          isScanned={isScanned}
          ocrStatus={ocrStatus}
          onTriggerOcr={handleTriggerOcr}
        />
      )}

      {/* 2.1 RETRACTION WARNING BANNER (Zotero-style alert) */}
      {(paper as any)?.isRetracted && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-12 z-30 shrink-0 border-b border-destructive/20 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="size-4 shrink-0 text-destructive-foreground animate-pulse" />
            <span className="font-semibold tracking-normal">
              {(paper as any).retractionNature === 'expression_of_concern'
                ? 'Expression of Concern'
                : (paper as any).retractionNature === 'correction'
                ? 'Publisher Correction'
                : 'Retracted Publication'}
            </span>
            <span className="text-destructive-foreground/90 truncate max-w-xl">
              - {(((paper as any).retractionDetails as any)?.reason) || 'This publication has been flagged as retracted or unreliable.'}
            </span>
          </div>
          {(((paper as any).retractionDetails as any)?.noticeUrl) && (
            <a
              href={((paper as any).retractionDetails as any).noticeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-12 text-destructive-foreground underline font-medium hover:text-destructive-foreground/80 shrink-0 ml-4 relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Notice <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* WORKSPACE VIEWPORT */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-muted">
        {/* 3. SIDEBAR (Collapsible 288px: Outline, Annotations & Pages) */}
        <Sidebar
          isOpen={isSidebarOpen && !isReadingMode}
          onClose={() => setIsSidebarOpen(false)}
          currentPage={visiblePage}
          totalPages={numPages}
          onJumpToPage={handleNavigateToPageWithHistory}
          fulltext={fulltext}
          paper={paper}
          scopeId={scopeId}
          attachmentId={effectiveAttachmentId}
          pdfBlobUrl={pdfBlobUrl}
          selectedIds={selectedAnnotationIds}
          onToggleSelect={handleToggleSelectAnnotation}
          annotationsCount={annotations.length}
          onAddToNote={handleAddToNote}
        />

        {/* 4. MAIN PDF CANVAS (Supports Single, Horizontal, and Vertical Split) */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden relative">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-foreground" strokeWidth={1.5} />
              <p className="text-12 text-foreground font-mono">Loading document...</p>
            </div>
          ) : !paper ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center max-w-sm mx-auto">
              <div className="size-10 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                <FileQuestion className="size-5 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-14 font-semibold tracking-tight text-foreground">Document not found</h3>
                <p className="text-12 text-foreground/80 leading-relaxed">
                  The document could not be found or you do not have permission.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goBack}
                className="h-8 px-3 mt-1 text-12 font-medium rounded-md cursor-pointer border border-border bg-background text-foreground hover:bg-muted relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronLeft className="size-3.5 mr-1 shrink-0 text-foreground" strokeWidth={1.5} />
                Return to Library
              </Button>
            </div>
          ) : paperUrl ? (
            splitMode === 'none' ? (
              <Viewer
                blobUrl={pdfBlobUrl}
                isLoading={pdfLoading}
                error={pdfError}
                onRetry={handleRetryPdf}
                onAskAi={handleAskAiWithInspector}
                onAddToNote={handleAddToNote}
                onAnnotate={handleAnnotateWithLock}
                annotations={annotations}
                onDeleteAnnotation={(ann) => deleteAnnotation && deleteAnnotation(ann.id, ann.version)}
                onUpdateAnnotation={(id, version, dto) => updateAnnotation && updateAnnotation(id, version, dto)}
                fulltext={fulltext}
                isLoadingFulltext={isLoadingFulltext}
                targetPage={targetPage}
                paper={paper}
                onVisiblePageChange={actions.setVisiblePage}
                onTotalPagesChange={actions.setNumPages}
                zoom={zoom}
                rotation={rotation}
                themeMode={themeMode}
                interactionMode={interactionMode}
                activeColor={activeColor}
                activeTool={activeTool}
                viewMode={viewMode}
                fitMode={fitMode}
                isSearchOpen={isSearchOpen}
                onCloseSearch={() => setIsSearchOpen(false)}
                initialSearchQuery={initialSearchQuery}
              />
            ) : (
              <div className={cn(
                "flex-1 flex min-w-0 min-h-0 overflow-hidden",
                splitMode === 'vertical' ? "flex-row divide-x divide-border" : "flex-col divide-y divide-border"
              )}>
                {/* Primary Split View */}
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
                  <Viewer
                    blobUrl={pdfBlobUrl}
                    isLoading={pdfLoading}
                    error={pdfError}
                    onRetry={handleRetryPdf}
                    onAskAi={handleAskAiWithInspector}
                    onAddToNote={handleAddToNote}
                    onAnnotate={handleAnnotateWithLock}
                    annotations={annotations}
                    onDeleteAnnotation={(ann) => deleteAnnotation && deleteAnnotation(ann.id, ann.version)}
                    onUpdateAnnotation={(id, version, dto) => updateAnnotation && updateAnnotation(id, version, dto)}
                    fulltext={fulltext}
                    isLoadingFulltext={isLoadingFulltext}
                    targetPage={targetPage}
                    paper={paper}
                    onVisiblePageChange={actions.setVisiblePage}
                    onTotalPagesChange={actions.setNumPages}
                    zoom={zoom}
                    rotation={rotation}
                    themeMode={themeMode}
                    interactionMode={interactionMode}
                    activeColor={activeColor}
                    activeTool={activeTool}
                    viewMode={viewMode}
                    fitMode={fitMode}
                    isSearchOpen={isSearchOpen}
                    onCloseSearch={() => setIsSearchOpen(false)}
                    initialSearchQuery={initialSearchQuery}
                  />
                </div>
                {/* Secondary Split View (Zotero: compare two sections of same document) */}
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
                  <Viewer
                    blobUrl={pdfBlobUrl}
                    isLoading={pdfLoading}
                    error={pdfError}
                    onRetry={handleRetryPdf}
                    onAskAi={handleAskAiWithInspector}
                    onAddToNote={handleAddToNote}
                    onAnnotate={handleAnnotateWithLock}
                    annotations={annotations}
                    onDeleteAnnotation={(ann) => deleteAnnotation && deleteAnnotation(ann.id, ann.version)}
                    onUpdateAnnotation={(id, version, dto) => updateAnnotation && updateAnnotation(id, version, dto)}
                    fulltext={fulltext}
                    isLoadingFulltext={isLoadingFulltext}
                    targetPage={null}
                    paper={paper}
                    zoom={zoom}
                    rotation={rotation}
                    themeMode={themeMode}
                    interactionMode={interactionMode}
                    activeColor={activeColor}
                    activeTool={activeTool}
                    viewMode={viewMode}
                    fitMode={fitMode}
                  />
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <p className="text-13 font-medium text-foreground mb-1">
                {paper.title || 'Paper Reference'}
              </p>
              <p className="text-12 text-foreground/80 leading-relaxed mb-4">
                No PDF file attached to this entry. You can review metadata or notes using the side panel.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInspectorOpen(true)}
                className="h-8 px-3 text-12 font-medium rounded-md cursor-pointer border border-border bg-background text-foreground hover:bg-muted relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Open Details
              </Button>
            </div>
          )}
        </main>

        {/* Academic Entities Drawer (Figures, Tables, Formulas) */}
        <DocumentNavDrawer
          isOpen={isEntitiesDrawerOpen && !isReadingMode}
          onClose={() => setIsEntitiesDrawerOpen(false)}
          fulltext={fulltext}
          isLoading={isLoadingFulltext}
          currentPage={visiblePage}
          onJumpToPage={(p) => handleNavigateToPageWithHistory(p)}
        />

        {/* 5. UNIFIED INSPECTOR PANEL */}
        {!isReadingMode && (
          <ReaderInspector
            paper={paper as any}
            item={paper as any}
            scopeId={scopeId}
            projectId={projectId}
            canEdit={true}
            onClose={() => setIsInspectorOpen(false)}
            onNavigateToAnnotation={handleNavigateToPageWithHistory}
            pendingNoteText={pendingNoteText}
            onClearPendingText={() => setPendingNoteText('')}
          />
        )}
      </div>

      {/* Batch Annotation Action Bar (Dock) */}
      <Systembar
        selectedCount={selectedAnnotationIds.size}
        onClearSelection={() => setSelectedAnnotationIds(new Set())}
        onChangeColor={handleBatchChangeColor}
        onAddToNote={handleBatchAddToNote}
        onBatchDelete={handleBatchDelete}
        isProcessing={isBatchProcessing}
      />

      {/* BibTeX / RIS Export Modal */}
      {paper && bibtexOpen && (
        <BibtexModal paper={paper} open={bibtexOpen} onOpenChange={setBibtexOpen} />
      )}
    </div>
  );
}
