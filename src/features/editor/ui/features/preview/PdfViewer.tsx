/**
 * PdfViewer.tsx
 *
 * Full PDF Preview Container with Overleaf Parity (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfViewer.tsx`
 *
 * Orchestrates:
 * - Scoped PdfToolbar (Recompile, Logs, Download, Zoom, Pages, View Options).
 * - Virtualized PDF.js Surface with SyncTeX double-click backward jump.
 * - In-document Ctrl+F PdfFindBar.
 * - Multi-monitor detached viewer with broadcast sync.
 * - Fullscreen presentation mode with laser pointer.
 * - CompilerLogs panel with AI Error Assist.
 *
 * NOTE: 0 dependencies on sub-features/ directory.
 */

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { usePageStore, useSettingsStore, useViewerStore, useLayoutStore } from '../../../store';
import { filesQuery, usePageActions } from '../../hooks/use-core';
import {
  extractPdfBookmarks,
  extractOutlineFromContent,
  type PdfOutlineItem,
} from '@/features/editor/domain/document/pdf-outline';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus, setActivePdfViewer } from '../../../coordinators/command-bus';

import { PdfToolbar } from './PdfToolbar';
import { PdfFindBar } from './PdfFindBar';
import PdfSurface, { type SurfaceHandle } from './PdfSurface';
import { parseLatexLog } from './CompilerLogs';
import DetachedViewerPlaceholder from './DetachedViewerPlaceholder';

import { usePdfZoom } from './hooks/use-pdf-zoom';
import { usePdfCompiler } from './hooks/use-pdf-compiler';
import { useViewerSyncTeX } from './hooks/use-viewer-synctex';
import { useViewerPopout } from './hooks/use-viewer-popout';
import { usePdfSearch } from './hooks/use-pdf-search';
import { useSynchronizedScroll } from './hooks/use-synchronized-scroll';

const PresentationModeModal = dynamic(
  () => import('./PresentationModeModal').then((mod) => mod.PresentationModeModal),
  { ssr: false }
);

export function PdfViewer() {
  const { projectId: rawProjectId, pageId: urlPageId, draftId } = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const storeProjectId = usePageStore((s) => s.projectId);
  const rawProj = rawProjectId || storeProjectId;
  const projectId = rawProj || undefined;
  const rootPageId = urlPageId ?? draftId ?? null;

  const documentTitle = usePageStore((s) => s.currentPage?.title);
  const { engine: editorEngine } = useEditorInstance();
  const pdfDocRef = useRef<any>(null);

  const pdfSpreadView = useSettingsStore((s) => s.pdfSpreadView);
  const togglePdfSpreadView = useSettingsStore((s) => s.togglePdfSpreadView);
  const syncScroll = useSettingsStore((s) => s.syncScroll);
  const toggleSyncScroll = useSettingsStore((s) => s.toggleSyncScroll);
  const activeFilePage = usePageStore((s) => s.activeFilePage);

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: !!rootPageId,
  });

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfSurfaceRef = useRef<SurfaceHandle | null>(null);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const pageNumber = useViewerStore((s) => s.pageNumber);
  const setPageNumber = useViewerStore((s) => s.setPageNumber);
  const numPages = useViewerStore((s) => s.numPages);
  const setNumPages = useViewerStore((s) => s.setNumPages);
  const invertColors = useViewerStore((s) => s.invertColors);
  const toggleInvertColors = useViewerStore((s) => s.toggleInvertColors);
  const handlePrevPage = useViewerStore((s) => s.prevPage);
  const handleNextPage = useViewerStore((s) => s.nextPage);

  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  const bottomPanelOpen = useLayoutStore((s) => s.bottomPanelOpen);
  const activeBottomTab = useLayoutStore((s) => s.activeBottomTab);
  const toggleBottomPanel = useLayoutStore((s) => s.toggleBottomPanel);
  const setBottomPanelOpen = useLayoutStore((s) => s.setBottomPanelOpen);
  const setActiveBottomTab = useLayoutStore((s) => s.setActiveBottomTab);

  // 1. Compilation Controller
  const {
    engine,
    setEngine,
    compileMode,
    setCompileMode,
    autoCompile,
    setAutoCompile,
    compileStatus,
    compileLog,
    pdfUrl,
    lastCompiledAt,
    synctexMapRef,
    rawSynctexRef,
    handleCompile,
    handleClearCacheAndCompile,
    handleForceSync,
    handleStopCompilation,
  } = usePdfCompiler({
    projectId,
    pageId: rootPageId,
    saveThumbnailMutation,
  });

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  const handleToggleLog = useCallback(() => {
    const hasIssues = (parsedLog?.errors.length ?? 0) > 0 || (parsedLog?.warnings.length ?? 0) > 0;
    const targetTab = hasIssues ? 'problems' : 'output';

    if (bottomPanelOpen && activeBottomTab === targetTab) {
      toggleBottomPanel();
    } else {
      setActiveBottomTab(targetTab);
      setBottomPanelOpen(true);
    }
  }, [bottomPanelOpen, activeBottomTab, toggleBottomPanel, setActiveBottomTab, setBottomPanelOpen, parsedLog]);

  // 2. Zoom & Scaling Controller
  const {
    scale,
    autoFit,
    containerWidth,
    showZoomGroup,
    showUtilityGroup,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleToggleAutoFit,
    handleSetScale,
  } = usePdfZoom({
    containerRef: pdfContainerRef,
    pdfSpreadView,
    pdfUrl,
  });

  // 3. Bidirectional SyncTeX Navigation Controller
  const { handleJumpToSource, handleJumpToPage } = useViewerSyncTeX({
    pageId: rootPageId,
    projectId,
    scale,
    autoFit,
    containerWidth,
    numPages,
    pageNumber,
    setPageNumber,
    pdfSurfaceRef,
    synctexMapRef,
    pageFiles,
  });

  useEffect(() => {
    setActivePdfViewer({
      scrollToPage: handleJumpToPage,
      surface: pdfSurfaceRef.current,
    });
    return () => {
      setActivePdfViewer(null);
    };
  }, [handleJumpToPage]);

  // 4. Detached Window & Popout Broadcast Controller
  const {
    isViewerPoppedOut,
    handlePopoutWindow,
    handleReattach,
    handleFocusPopout,
  } = useViewerPopout({
    pageId: rootPageId,
    projectId,
    pdfUrl,
    compileStatus,
    compileLog: compileLog || '',
    lastCompiledAt,
    engine: engine || 'pdflatex',
    compileMode: compileMode || 'full',
    rawSynctex: rawSynctexRef.current,
    handleCompile,
    handleForceSync,
    handleJumpToSource,
  });

  // 5. In-Document PDF Search Controller
  const {
    isOpen: isSearchOpen,
    query: searchQuery,
    setQuery: setSearchQuery,
    matches: searchMatches,
    currentMatchIndex,
    isSearching,
    nextMatch,
    prevMatch,
    toggleSearch,
    closeSearch,
  } = usePdfSearch({
    pdfDocRef,
    pdfContainerRef,
    onScrollToPage: (p) => pdfSurfaceRef.current?.scrollToPage(p),
  });

  // 6. Split-View Synchronized Dual Scrolling Controller
  const { handleViewerScroll } = useSynchronizedScroll({
    enabled: syncScroll,
    pdfSurfaceRef,
    synctexMapRef,
    numPages,
    scale,
    autoFit,
    containerWidth,
    activeFilePath: activeFilePage?.title || 'main.tex',
  });

  // F5 shortcut for Presentation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' && pdfUrl && !isPresentationOpen) {
        e.preventDefault();
        setIsPresentationOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfUrl, isPresentationOpen]);

  // Auto-open Bottom Panel with Problems on compile error
  useEffect(() => {
    if (compileStatus === 'error') {
      useLayoutStore.getState().openBottomPanelWithTab('problems');
    }
  }, [compileStatus]);

  // Open AI Assistant in Left Sidebar when editor requests AI fix
  useEffect(() => {
    return editorCommandBus.subscribe('editor:suggest-fix', () => {
      useLayoutStore.getState().setSidebarLeftOpen(true);
    });
  }, []);


  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    pdfDocRef.current = pdf;

    try {
      const bookmarks = await extractPdfBookmarks(pdf);
      if (bookmarks && bookmarks.length > 0) {
        setPdfOutline(bookmarks);
        return;
      }
    } catch {
      // fallback
    }

    const rawContent = editorEngine?.getContent() || usePageStore.getState().activeFilePage?.content || '';
    const content = typeof rawContent === 'string' ? rawContent : (rawContent as any)?.source || (rawContent as any)?.text || '';
    const fallback = extractOutlineFromContent(content, pdf.numPages || 1, synctexMapRef.current as any);
    setPdfOutline(fallback);
  }, [editorEngine, synctexMapRef]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = downloadRef.current || document.createElement('a');
    a.href = pdfUrl;
    a.download = `${documentTitle?.replace(/\s+/g, '_') || 'document'}.pdf`;
    a.click();
  }, [pdfUrl, documentTitle]);

  const handleToggleAutoCompile = useCallback(() => setAutoCompile(!autoCompile), [autoCompile, setAutoCompile]);
  const handleToggleInvertColors = toggleInvertColors;
  const handleSetCompileMode = useCallback((m: 'full' | 'draft') => setCompileMode(m), [setCompileMode]);

  // If detached, show placeholder with toolbar controls
  if (isViewerPoppedOut) {
    return (
      <div className="h-full flex flex-col bg-canvas select-none relative min-h-0">
        <PdfToolbar
          compileStatus={compileStatus}
          engine={engine}
          setEngine={setEngine}
          compileMode={compileMode as 'full' | 'draft'}
          setCompileMode={handleSetCompileMode}
          autoCompile={autoCompile}
          onToggleAutoCompile={handleToggleAutoCompile}
          onClearCacheAndCompile={handleClearCacheAndCompile}
          onStopCompilation={handleStopCompilation}
          onCompile={handleCompile}
          onForceSync={handleForceSync}
          scale={scale}
          autoFit={autoFit}
          showZoomGroup={false}
          onToggleAutoFit={handleToggleAutoFit}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          pageNumber={pageNumber}
          numPages={numPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          pdfUrl={pdfUrl}
          compileLog={compileLog || ''}
          showLog={bottomPanelOpen}
          showUtilityGroup={showUtilityGroup}
          onToggleLog={handleToggleLog}
          onDownload={handleDownload}
          onPopout={handleReattach}
          isPoppedOut={true}
          outline={pdfOutline}
          onJumpToPage={handleJumpToPage}
          invertColors={invertColors}
          onToggleInvertColors={handleToggleInvertColors}
          onSetScale={handleSetScale}
          onOpenPresentationMode={() => setIsPresentationOpen(true)}
          errorCount={parsedLog?.errors.length ?? 0}
          warningCount={parsedLog?.warnings.length ?? 0}
          syncScroll={syncScroll}
          onToggleSyncScroll={toggleSyncScroll}
        />
        <DetachedViewerPlaceholder
          compileStatus={compileStatus}
          lastCompiledAt={lastCompiledAt}
          onReattach={handleReattach}
          onFocusWindow={handleFocusPopout}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-canvas select-none relative min-h-0">
      <PdfToolbar
        compileStatus={compileStatus}
        engine={engine}
        setEngine={setEngine}
        compileMode={compileMode as 'full' | 'draft'}
        setCompileMode={handleSetCompileMode}
        autoCompile={autoCompile}
        onToggleAutoCompile={handleToggleAutoCompile}
        onClearCacheAndCompile={handleClearCacheAndCompile}
        onStopCompilation={handleStopCompilation}
        onCompile={handleCompile}
        onForceSync={handleForceSync}
        scale={scale}
        autoFit={autoFit}
        showZoomGroup={showZoomGroup}
        onToggleAutoFit={handleToggleAutoFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onSetScale={handleSetScale}
        pageNumber={pageNumber}
        numPages={numPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        pdfUrl={pdfUrl}
        compileLog={compileLog || ''}
        showLog={bottomPanelOpen}
        showUtilityGroup={showUtilityGroup}
        onToggleLog={handleToggleLog}
        onDownload={handleDownload}
        onPopout={handlePopoutWindow}
        isPoppedOut={false}
        outline={pdfOutline}
        onJumpToPage={handleJumpToPage}
        invertColors={invertColors}
        onToggleInvertColors={handleToggleInvertColors}
        isSpreadView={pdfSpreadView}
        onToggleSpreadView={togglePdfSpreadView}
        isSearchOpen={isSearchOpen}
        onToggleSearch={toggleSearch}
        onOpenPresentationMode={() => setIsPresentationOpen(true)}
        errorCount={parsedLog?.errors.length ?? 0}
        warningCount={parsedLog?.warnings.length ?? 0}
        syncScroll={syncScroll}
        onToggleSyncScroll={toggleSyncScroll}
      />

      <a ref={downloadRef} className="hidden" aria-hidden="true" />

      {/* PDF Viewer Surface */}
      <div ref={pdfContainerRef} className="flex-1 min-h-0 relative flex flex-col">
        <PdfFindBar
          isOpen={isSearchOpen}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          matchesCount={searchMatches.length}
          currentMatchIndex={currentMatchIndex}
          isSearching={isSearching}
          onNext={nextMatch}
          onPrev={prevMatch}
          onClose={closeSearch}
        />
        <PdfSurface
          ref={pdfSurfaceRef}
          pdfUrl={pdfUrl}
          synctexMap={synctexMapRef.current}
          scale={scale}
          autoFit={autoFit}
          containerWidth={containerWidth}
          scrollMode={true}
          pageNumber={pageNumber}
          numPages={numPages}
          compileStatus={compileStatus}
          onPageNumberChange={setPageNumber}
          onNumPagesChange={setNumPages}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
          onJumpToSource={handleJumpToSource}
          onCompile={handleCompile}
          invertColors={invertColors}
          isSpreadView={pdfSpreadView}
          onScroll={handleViewerScroll}
        />
      </div>

      {/* Presentation Mode Fullscreen Modal */}
      {isPresentationOpen && (
        <PresentationModeModal
          isOpen={isPresentationOpen}
          onClose={() => setIsPresentationOpen(false)}
          pdfUrl={pdfUrl}
          initialPage={pageNumber}
          numPages={numPages}
          onPageChange={setPageNumber}
        />
      )}
    </div>
  );
}

export default PdfViewer;
