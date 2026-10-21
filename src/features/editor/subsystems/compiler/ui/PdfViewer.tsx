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

import { usePageStore, useSettingsStore, useWorkspaceStore } from '@/features/editor/core';
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
import PdfSurface, { type PdfSurfaceHandle } from './PdfSurface';
import { CompilerLogs, parseLatexLog } from './CompilerLogs';
import { filterDiagnostics } from '@/features/editor/domain/latex/warning-filter';

import { usePdfZoom } from './hooks/usePdfZoom';
import { usePdfCompiler } from './hooks/usePdfCompiler';
import { useViewerSyncTeX } from './hooks/useViewerSyncTeX';
import { useSynchronizedScroll } from './hooks/useSynchronizedScroll';
import { usePdfSearch, type PdfDocumentProxyLike } from './hooks/usePdfSearch';

const TRANSIENT_WARNING_REGEX = /(?:^|Warning:\s*)(?:Reference|Citation)\s+.+undefined\s+on\s+input\s+line/i;

export interface PdfViewerProps {
  isDetached?: boolean;
}

export function PdfViewer({ isDetached = false }: PdfViewerProps = {}) {
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
  const activeFilePath = usePageStore((s) => {
    const af = s.activeFilePage;
    if (af && 'path' in af && typeof af.path === 'string' && af.path) {
      return af.path;
    }
    return af?.title || undefined;
  });

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: !!rootPageId,
  });

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfSurfaceRef = useRef<PdfSurfaceHandle | null>(null);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const setPageNumber = useViewerStore((s: DocumentViewerState) => s.setPageNumber);
  const numPages = useViewerStore((s: DocumentViewerState) => s.numPages);
  const setNumPages = useViewerStore((s: DocumentViewerState) => s.setNumPages);
  const invertColors = useViewerStore((s: DocumentViewerState) => s.invertColors);
  const toggleInvertColors = useViewerStore((s: DocumentViewerState) => s.toggleInvertColors);
  const handlePrevPage = useViewerStore((s: DocumentViewerState) => s.prevPage);
  const handleNextPage = useViewerStore((s: DocumentViewerState) => s.nextPage);

  const [, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [pageDimensions, setPageDimensions] = useState<PdfPageDimensions>({
    widthPt: DEFAULT_PDF_PAGE_WIDTH_PT,
    heightPt: DEFAULT_PDF_PAGE_HEIGHT_PT,
  });

  const [showLogsOverlay, setShowLogsOverlay] = useState<boolean>(false);

  // 1. Compilation Controller
  const {
    compileStatus,
    compileLog,
    pdfUrl,
    synctexMapRef,
    handleCompile,
    handleClearCacheAndCompile,
    handleStopCompilation,
  } = usePdfCompiler({
    projectId,
    pageId: rootPageId,
    saveThumbnailMutation,
  });

  const suppressBadBoxes = useSettingsStore((s) => s.suppressBadBoxes);
  const suppressFontWarnings = useSettingsStore((s) => s.suppressFontWarnings);
  const suppressPackageWarnings = useSettingsStore((s) => s.suppressPackageWarnings);
  const customSuppressedWarnings = useSettingsStore((s) => s.customSuppressedWarnings);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  const filteredWarningCount = useMemo(() => {
    if (!parsedLog) return 0;
    let warnings = parsedLog.warnings;
    if (stopOnFirstError && parsedLog.errors.length > 0) {
      warnings = warnings.filter((w) => !TRANSIENT_WARNING_REGEX.test(w.message || ''));
    }
    return filterDiagnostics(warnings, {
      suppressBadBoxes,
      suppressFontWarnings,
      suppressPackageWarnings,
      customPatterns: customSuppressedWarnings,
    }).length;
  }, [
    parsedLog,
    stopOnFirstError,
    suppressBadBoxes,
    suppressFontWarnings,
    suppressPackageWarnings,
    customSuppressedWarnings,
  ]);

  const handleToggleLog = useCallback(() => {
    setShowLogsOverlay((prev) => !prev);
  }, []);

  // 2. Zoom & Scaling Controller
  const {
    scale,
    autoFit,
    fitMode,
    containerWidth,
    handleZoomIn,
    handleZoomOut,
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
      pdfDocRef.current = null;
    };
  }, [handleJumpToPage]);

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


  // Auto-switch to CompilerLogs on compilation error when no PDF is available, and return to PDF on successful compile
  const prevCompileStatusRef = useRef(compileStatus);
  useEffect(() => {
    if (compileStatus === 'error' && !pdfUrl) {
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


  const onDocumentLoadSuccess = useCallback(async (pdf: { numPages: number } & Partial<PdfDocumentProxyLike>) => {
    pdfDocRef.current = pdf as PdfDocumentProxyLike;

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
            onClearCacheAndCompile={handleClearCacheAndCompile}
            onStopCompilation={handleStopCompilation}
            onCompile={handleCompile}
            scale={scale}
            autoFit={autoFit}
            fitMode={fitMode}
            onToggleAutoFit={handleToggleAutoFit}
            onSetFitMode={handleSetFitMode}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetScale={handleSetScale}
            numPages={numPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            pdfUrl={pdfUrl}
            showLog={showLogsOverlay}
            onToggleLog={handleToggleLog}
            onDownload={handleDownload}
            onJumpToPage={handleJumpToPage}
            invertColors={invertColors}
            onToggleInvertColors={toggleInvertColors}
            isSpreadView={pdfSpreadView}
            onToggleSpreadView={togglePdfSpreadView}
            isSearchOpen={isSearchOpen}
            onToggleSearch={toggleSearch}
            syncScroll={syncScroll}
            onToggleSyncScroll={toggleSyncScroll}
            errorCount={parsedLog?.errors.length ?? 0}
            warningCount={filteredWarningCount}
            isDetached={isDetached}
          />

          <a ref={downloadRef} className="hidden" aria-hidden="true" />

          {/* PDF Viewer Surface (Overleaf 1:1 Parity) */}
          <div ref={pdfContainerRef} className="flex-1 min-h-0 relative flex flex-col">
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
