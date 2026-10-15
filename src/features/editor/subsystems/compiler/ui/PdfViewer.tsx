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

import { usePageStore, useSettingsStore, useLayoutStore } from '@/features/editor/core';
import { useViewerStore, type DocumentViewerState } from '@/features/editor/subsystems/compiler/coordinator/viewer.store';
import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import { usePageActions } from '@/features/editor/ui/hooks/usePageActions';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import {
  extractPdfBookmarks,
  extractOutlineFromContent,
  type PdfOutlineItem,
} from '@/features/editor/subsystems/compiler/synctex/pdf-outline';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { editorCommandBus, setActivePdfViewer } from '@/features/editor/core';

import { PdfToolbar } from './PdfToolbar';
import { PdfFindBar } from './PdfFindBar';
import { CompilationErrorBanner } from './CompilationErrorBanner';
import PdfSurface, { type SurfaceHandle } from './PdfSurface';
import { CompilerLogs, parseLatexLog } from './CompilerLogs';

import { usePdfZoom } from './hooks/usePdfZoom';
import { usePdfCompiler } from './hooks/usePdfCompiler';
import { useViewerSyncTeX } from './hooks/useViewerSyncTeX';
import { useSynchronizedScroll } from './hooks/useSynchronizedScroll';
import { usePdfSearch, type PdfDocumentProxyLike } from './hooks/usePdfSearch';

export function PdfViewer() {
  const {
    id: urlId,
    projectId: rawProjectId,
    pageId: urlPageId,
    draftId,
  } = useParams<{
    id?: string;
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const storeProjectId = usePageStore((s) => s.projectId);
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const rawProj = rawProjectId || storeProjectId;
  const projectId = rawProj || undefined;
  const rootPageId = urlPageId ?? urlId ?? draftId ?? currentPageId ?? null;

  const documentTitle = usePageStore((s) => s.currentPage?.title);
  const { engine: editorEngine } = useEditorInstance();
  const pdfDocRef = useRef<PdfDocumentProxyLike | null>(null);

  const pdfSpreadView = useSettingsStore((s) => s.pdfSpreadView);
  const togglePdfSpreadView = useSettingsStore((s) => s.togglePdfSpreadView);
  const pdfViewer = useSettingsStore((s) => s.pdfViewer);
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

  const setPageNumber = useViewerStore((s: DocumentViewerState) => s.setPageNumber);
  const numPages = useViewerStore((s: DocumentViewerState) => s.numPages);
  const setNumPages = useViewerStore((s: DocumentViewerState) => s.setNumPages);
  const invertColors = useViewerStore((s: DocumentViewerState) => s.invertColors);
  const toggleInvertColors = useViewerStore((s: DocumentViewerState) => s.toggleInvertColors);
  const handlePrevPage = useViewerStore((s: DocumentViewerState) => s.prevPage);
  const handleNextPage = useViewerStore((s: DocumentViewerState) => s.nextPage);

  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [pageDimensions, setPageDimensions] = useState<PdfPageDimensions>({
    widthPt: DEFAULT_PDF_PAGE_WIDTH_PT,
    heightPt: DEFAULT_PDF_PAGE_HEIGHT_PT,
  });

  const [showLogsOverlay, setShowLogsOverlay] = useState<boolean>(false);

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
    setShowLogsOverlay((prev) => !prev);
  }, []);

  // 2. Zoom & Scaling Controller
  const {
    scale,
    autoFit,
    fitMode,
    containerWidth,
    showZoomGroup,
    showUtilityGroup,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleToggleAutoFit,
    handleSetFitMode,
    handleSetScale,
  } = usePdfZoom({
    containerRef: pdfContainerRef,
    pdfSpreadView,
    pdfUrl,
    pageDimensions,
  });

  // 3. Bidirectional SyncTeX Navigation Controller
  const { handleJumpToSource, handleJumpToPage } = useViewerSyncTeX({
    pageId: rootPageId,
    projectId,
    scale,
    autoFit,
    containerWidth,
    numPages,
    setPageNumber,
    pdfSurfaceRef,
    synctexMapRef,
    pageFiles,
    pageDimensions,
  });

  // 3b. Dual-Window Synchronized Dual Scrolling Controller
  const activeFilePath = useMemo(() => {
    if (activeFilePage && 'path' in activeFilePage && typeof activeFilePage.path === 'string') {
      return activeFilePage.path;
    }
    return activeFilePage?.title || undefined;
  }, [activeFilePage]);

  const { handleViewerScroll } = useSynchronizedScroll({
    enabled: Boolean(syncScroll && pdfViewer !== 'browser'),
    pdfSurfaceRef,
    synctexMapRef,
    numPages,
    scale,
    autoFit,
    containerWidth,
    activeFilePath,
    pageDimensions,
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

  // Jump to first compilation error (Overleaf 1:1 parity)
  const firstError = parsedLog?.errors?.[0];
  const handleJumpToFirstError = useCallback(() => {
    const line = firstError?.line || 1;
    const file = firstError?.file || null;
    handleJumpToSource(file, line, undefined, undefined, undefined, 'error');
    editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'error' });
    editorCommandBus.dispatch({ type: 'editor:focus' });
  }, [firstError, handleJumpToSource]);

  // 4. In-Document PDF Search Controller
  const {
    isOpen: isSearchOpen,
    query: searchQuery,
    setQuery: setSearchQuery,
    matches: searchMatches,
    currentMatchIndex,
    isSearching,
    caseSensitive,
    toggleCaseSensitive,
    wholeWord,
    toggleWholeWord,
    regex: useRegex,
    toggleRegex,
    isRegexError,
    nextMatch,
    prevMatch,
    toggleSearch,
    closeSearch,
    applyDomHighlights,
  } = usePdfSearch({
    pdfDocRef,
    pdfContainerRef,
    onScrollToPage: (p: number) => pdfSurfaceRef.current?.scrollToPage(p),
  });


  // Auto-switch to CompilerLogs on compilation error, and return to PDF on successful compile
  const prevCompileStatusRef = useRef(compileStatus);
  useEffect(() => {
    if (compileStatus === 'error') {
      setShowLogsOverlay(true);
    } else if (
      (compileStatus === 'idle' || compileStatus === 'done') &&
      (prevCompileStatusRef.current === 'compiling' ||
        prevCompileStatusRef.current === 'error' ||
        prevCompileStatusRef.current === 'done') &&
      pdfUrl &&
      (parsedLog?.errors.length ?? 0) === 0
    ) {
      setShowLogsOverlay(false);
    }
    prevCompileStatusRef.current = compileStatus;
  }, [compileStatus, pdfUrl, parsedLog]);

  // Open CompilerLogs and AI Assistant in Left Sidebar when editor requests AI fix
  useEffect(() => {
    return editorCommandBus.subscribe('editor:suggest-fix', () => {
      setShowLogsOverlay(true);
      useLayoutStore.getState().setSidebarLeftOpen(true);
    });
  }, []);


  const onDocumentLoadSuccess = useCallback(async (pdf: { numPages: number } & Partial<PdfDocumentProxyLike>) => {
    pdfDocRef.current = pdf as PdfDocumentProxyLike;

    if (typeof pdf.getPage === 'function' && (pdf.numPages ?? 0) >= 1) {
      try {
        const page = await pdf.getPage(1);
        const pageWithViewport = page as {
          getViewport?: (params: { scale: number }) => { width?: number; height?: number };
          view?: number[];
        };
        let widthPt = 0;
        let heightPt = 0;
        if (typeof pageWithViewport?.getViewport === 'function') {
          const vp = pageWithViewport.getViewport({ scale: 1 });
          widthPt = vp?.width || 0;
          heightPt = vp?.height || 0;
        }
        if ((!widthPt || !heightPt) && Array.isArray(pageWithViewport?.view) && pageWithViewport.view.length >= 4) {
          widthPt = widthPt || (pageWithViewport.view[2] - pageWithViewport.view[0]);
          heightPt = heightPt || (pageWithViewport.view[3] - pageWithViewport.view[1]);
        }
        setPageDimensions({
          widthPt: widthPt > 0 ? widthPt : DEFAULT_PDF_PAGE_WIDTH_PT,
          heightPt: heightPt > 0 ? heightPt : DEFAULT_PDF_PAGE_HEIGHT_PT,
        });
      } catch {
        // fallback to default A4 or PdfSurface onPageDimensionsChange
      }
    }

    try {
      const bookmarks = await extractPdfBookmarks(pdf as unknown as Parameters<typeof extractPdfBookmarks>[0]);
      if (bookmarks && bookmarks.length > 0) {
        setPdfOutline(bookmarks);
        return;
      }
    } catch {
      // fallback
    }

    const rawContent = editorEngine?.getContent() || usePageStore.getState().activeFilePage?.content || '';
    const record = typeof rawContent === 'object' && rawContent !== null ? (rawContent as Record<string, unknown>) : null;
    const content = typeof rawContent === 'string' ? rawContent : typeof record?.source === 'string' ? record.source : typeof record?.text === 'string' ? record.text : '';
    const fallback = extractOutlineFromContent(content, pdf.numPages || 1, synctexMapRef.current);
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

  return (
    <div className="h-full w-full flex flex-col bg-canvas select-none relative min-h-0">
      {showLogsOverlay ? (
        <div className="relative flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
          <CompilerLogs
            log={compileLog || ''}
            parsedLog={parsedLog ?? undefined}
            onClose={() => setShowLogsOverlay(false)}
            onCompile={handleCompile}
            onClearCacheAndCompile={handleClearCacheAndCompile}
            onStopCompilation={handleStopCompilation}
            onJumpToError={(file, line) =>
              handleJumpToSource(file || null, line, undefined, undefined, undefined, 'error')
            }
          />
        </div>
      ) : (
        <>
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
            fitMode={fitMode}
            showZoomGroup={showZoomGroup}
            onToggleAutoFit={handleToggleAutoFit}
            onSetFitMode={handleSetFitMode}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onSetScale={handleSetScale}
            numPages={numPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            pdfUrl={pdfUrl}
            compileLog={compileLog || ''}
            showLog={showLogsOverlay}
            showUtilityGroup={showUtilityGroup}
            onToggleLog={handleToggleLog}
            onDownload={handleDownload}
            outline={pdfOutline}
            onJumpToPage={handleJumpToPage}
            invertColors={invertColors}
            onToggleInvertColors={handleToggleInvertColors}
            isSpreadView={pdfSpreadView}
            onToggleSpreadView={togglePdfSpreadView}
            isSearchOpen={isSearchOpen}
            onToggleSearch={toggleSearch}
            syncScroll={syncScroll}
            onToggleSyncScroll={toggleSyncScroll}
            errorCount={parsedLog?.errors.length ?? 0}
            warningCount={parsedLog?.warnings.length ?? 0}
          />

          <a ref={downloadRef} className="hidden" aria-hidden="true" />

          {/* ── Compilation Error Floating Banner (Overleaf 1:1 Parity) ── */}
          {(parsedLog?.errors.length ?? 0) > 0 && (
            <CompilationErrorBanner
              errorCount={parsedLog!.errors.length}
              onJumpToFirstError={handleJumpToFirstError}
              onOpenLogs={handleToggleLog}
            />
          )}

          {/* PDF Viewer Surface (Overleaf 1:1 Parity) */}
          <div ref={pdfContainerRef} className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
            <PdfFindBar
              isOpen={isSearchOpen}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              matchesCount={searchMatches.length}
              currentMatchIndex={currentMatchIndex}
              isSearching={isSearching}
              caseSensitive={caseSensitive}
              onToggleCaseSensitive={toggleCaseSensitive}
              wholeWord={wholeWord}
              onToggleWholeWord={toggleWholeWord}
              useRegex={useRegex}
              onToggleRegex={toggleRegex}
              isRegexError={isRegexError}
              onNext={nextMatch}
              onPrev={prevMatch}
              onClose={closeSearch}
            />
            {pdfViewer === 'browser' ? (
              <div className="flex-1 w-full h-full bg-muted/10 flex flex-col items-center justify-center relative">
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title="Native Browser PDF Viewer"
                  />
                ) : (
                  <div className="text-muted-foreground text-xs font-mono">
                    No compiled PDF available yet.
                  </div>
                )}
              </div>
            ) : (
              <PdfSurface
                ref={pdfSurfaceRef}
                pdfUrl={pdfUrl}
                synctexMap={synctexMapRef.current}
                scale={scale}
                autoFit={autoFit}
                containerWidth={containerWidth}
                pageDimensions={pageDimensions}
                onPageDimensionsChange={setPageDimensions}
                scrollMode={true}
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
                onRenderTextLayer={applyDomHighlights}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PdfViewer;
