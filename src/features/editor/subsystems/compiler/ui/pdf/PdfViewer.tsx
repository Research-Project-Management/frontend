/**
 * PdfViewer.tsx
 *
 * Full PDF Preview Container with Overleaf Parity (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/PdfViewer.tsx`
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
import {
  useCompileStore,
  useFilteredCompileDiagnostics,
} from '@/features/editor/subsystems/compiler/store/compiler.store';
import { useViewerStore, type DocumentViewerState } from '@/features/editor/subsystems/compiler/store/viewer.store';
import { filesQuery } from '@/features/editor/core/queries/document.queries';
import { usePageActions } from '@/features/editor/core/queries/usePageActions';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
} from '@/features/editor/subsystems/compiler/synctex/synctex';
import type { CompilerLogFocusTarget } from '@/features/editor/domain/types/compiler.types';
import { editorCommandBus, setActivePdfViewer } from '@/features/editor/core';

import { PdfToolbar } from './PdfToolbar';
import { PdfFindBar } from './PdfFindBar';
import { CompilationErrorBanner } from '../ErrorBanner';
import PdfSurface, { type PdfSurfaceHandle } from './PdfSurface';
import { CompilerLogs, parseLatexLog } from '../logs/LogsPanel';

import { usePdfZoom } from '@/features/editor/subsystems/compiler/hooks/usePdfZoom';
import { usePdfCompiler } from '@/features/editor/subsystems/compiler/hooks/useCompiler';
import { useViewerSyncTeX, type ViewerPageFileEntry } from '@/features/editor/subsystems/compiler/hooks/useSyncTeX';
import { useSynchronizedScroll } from '@/features/editor/subsystems/compiler/hooks/useSyncScroll';
import { usePdfSearch, type PdfDocumentProxyLike } from '@/features/editor/subsystems/compiler/hooks/usePdfSearch';

const EMPTY_PAGE_FILES: ViewerPageFileEntry[] = [];

interface PdfViewerProps {
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

  const storeProjectId = usePageStore((s) => s.spaceId || s.projectId);
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const rawProj = rawProjectId || storeProjectId;
  const projectId = rawProj || undefined;
  const rootPageId = urlPageId ?? urlId ?? draftId ?? currentPageId ?? null;

  const documentTitle = usePageStore((s) => s.currentPage?.title);
  const pdfDocRef = useRef<PdfDocumentProxyLike | null>(null);

  const pdfSpreadView = useSettingsStore((s) => s.pdfSpreadView);
  const pdfViewer = useSettingsStore((s) => s.pdfViewer);
  const syncScroll = useSettingsStore((s) => s.syncScroll);
  const activeFilePath = usePageStore((s) => {
    const af = s.activeFilePage;
    if (af && 'path' in af && typeof af.path === 'string' && af.path) {
      return af.path;
    }
    return af?.title || undefined;
  });

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const { data: pageFiles = EMPTY_PAGE_FILES } = useQuery({
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
  const handlePrevPage = useViewerStore((s: DocumentViewerState) => s.prevPage);
  const handleNextPage = useViewerStore((s: DocumentViewerState) => s.nextPage);

  const [pageDimensions, setPageDimensions] = useState<PdfPageDimensions>({
    widthPt: DEFAULT_PDF_PAGE_WIDTH_PT,
    heightPt: DEFAULT_PDF_PAGE_HEIGHT_PT,
  });

  const handlePageDimensionsChange = useCallback((dims: PdfPageDimensions) => {
    setPageDimensions((prev) =>
      prev.widthPt === dims.widthPt && prev.heightPt === dims.heightPt ? prev : dims,
    );
  }, []);

  const [showLogsOverlay, setShowLogsOverlay] = useState<boolean>(false);
  const [pendingLogFocus, setPendingLogFocus] = useState<CompilerLogFocusTarget | null>(null);
  const logFocusNonceRef = useRef(0);

  useEffect(() => {
    return editorCommandBus.subscribe('compiler:open-logs', (cmd) => {
      setShowLogsOverlay(true);
      logFocusNonceRef.current += 1;
      setPendingLogFocus({
        file: cmd.file,
        line: cmd.line,
        severity: cmd.severity,
        message: cmd.message,
        nonce: logFocusNonceRef.current,
      });
    });
  }, []);

  // 1. Compilation Controller
  const {
    compileStatus,
    compileLog,
    pdfUrl,
    synctexMap,
    synctexMapRef,
    handleCompile,
    handleClearCacheAndCompile,
    handleStopCompilation,
  } = usePdfCompiler({
    projectId,
    pageId: rootPageId,
    saveThumbnailMutation,
  });

  const compilePhase = useCompileStore((s) => s.compilePhase);
  const compileOutcome = useCompileStore((s) => s.compileOutcome);
  const compileReport = useCompileStore((s) => s.compileReport);
  const storeParsedLog = useCompileStore((s) => s.parsedLog);
  const storeDiagnostics = useCompileStore((s) => s.compileDiagnostics);

  const fallbackParsedLog = useMemo(() => {
    if (storeParsedLog) return storeParsedLog;
    if (compileLog) return parseLatexLog(compileLog, storeDiagnostics);
    return null;
  }, [storeParsedLog, storeDiagnostics, compileLog]);

  const filteredDiagnostics = useFilteredCompileDiagnostics(fallbackParsedLog, true);

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
    projectId: projectId || rootPageId || undefined,
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

  const handleSearchScrollToPage = useCallback((p: number) => {
    pdfSurfaceRef.current?.scrollToPage(p);
  }, []);

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
    closeSearch,
    applyDomHighlights,
  } = usePdfSearch({
    pdfDocRef,
    pdfContainerRef,
    onScrollToPage: handleSearchScrollToPage,
  });


  const handleJumpToFirstError = useCallback(() => {
    const firstErr = filteredDiagnostics.errors[0];
    if (firstErr) {
      handleJumpToSource(
        firstErr.file || null,
        firstErr.line ?? 1,
        undefined,
        undefined,
        undefined,
        'error',
      );
      return;
    }
    setShowLogsOverlay(true);
  }, [filteredDiagnostics.errors, handleJumpToSource]);

  // Auto-open CompilerLogs when a build finishes with errors/failure/timeout/validation issues,
  // and return to PDF on a clean success build (without snapping back if user clicks "Back to PDF").
  const prevCompileStatusRef = useRef(compileStatus);
  const lastHandledCompileReportRef = useRef(compileReport);
  useEffect(() => {
    if (
      compileReport &&
      compileReport !== lastHandledCompileReportRef.current &&
      compilePhase === 'done'
    ) {
      lastHandledCompileReportRef.current = compileReport;
      if (
        compileOutcome === 'failure' ||
        compileOutcome === 'stopped-on-first-error' ||
        compileOutcome === 'timedout' ||
        compileOutcome === 'validation-problems'
      ) {
        setShowLogsOverlay(true);
      } else if (
        compileOutcome === 'success' &&
        filteredDiagnostics.errors.length === 0 &&
        pdfUrl
      ) {
        setShowLogsOverlay(false);
      }
      prevCompileStatusRef.current = compileStatus;
      return;
    }

    if (!compileReport) {
      if (compileStatus === 'error' && !pdfUrl) {
        setShowLogsOverlay(true);
      } else if (
        (compileStatus === 'idle' || compileStatus === 'done') &&
        (prevCompileStatusRef.current === 'compiling' ||
          prevCompileStatusRef.current === 'error' ||
          prevCompileStatusRef.current === 'done') &&
        pdfUrl &&
        filteredDiagnostics.errors.length === 0
      ) {
        setShowLogsOverlay(false);
      }
    }
    prevCompileStatusRef.current = compileStatus;
  }, [
    compileReport,
    compilePhase,
    compileOutcome,
    compileStatus,
    pdfUrl,
    filteredDiagnostics.errors.length,
  ]);


  const onDocumentLoadSuccess = useCallback((pdf: { numPages: number } & Partial<PdfDocumentProxyLike>) => {
    pdfDocRef.current = pdf as PdfDocumentProxyLike;
  }, []);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = downloadRef.current || document.createElement('a');
    a.href = pdfUrl;
    a.download = `${documentTitle?.replace(/\s+/g, '_') || 'document'}.pdf`;
    a.click();
  }, [pdfUrl, documentTitle]);

  const handleCloseLogs = useCallback(() => {
    setShowLogsOverlay(false);
    setPendingLogFocus(null);
  }, []);

  const handleFocusTargetHandled = useCallback(() => {
    setPendingLogFocus(null);
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-canvas select-none relative min-h-0">
      {showLogsOverlay ? (
        <div className="relative flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
          <CompilerLogs
            log={compileLog || ''}
            parsedLog={fallbackParsedLog ?? undefined}
            onClose={handleCloseLogs}
            onCompile={handleCompile}
            onClearCacheAndCompile={handleClearCacheAndCompile}
            onStopCompilation={handleStopCompilation}
            onJumpToError={(file, line) =>
              handleJumpToSource(file || null, line, undefined, undefined, undefined, 'error')
            }
            focusTarget={pendingLogFocus}
            onFocusTargetHandled={handleFocusTargetHandled}
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
            errorCount={filteredDiagnostics.errors.length}
            warningCount={filteredDiagnostics.warnings.length}
            isDetached={isDetached}
          />

          <a ref={downloadRef} className="hidden" aria-hidden="true" />

          {/* PDF Viewer Surface (Overleaf 1:1 Parity) */}
          <div ref={pdfContainerRef} className="flex-1 min-h-0 relative flex flex-col">
            <CompilationErrorBanner
              errorCount={filteredDiagnostics.errors.length}
              outcome={compileOutcome}
              errorMessage={compileReport?.errorMessage}
              onJumpToFirstError={handleJumpToFirstError}
              onOpenLogs={() => setShowLogsOverlay(true)}
              onRetry={handleCompile}
              onCompileAnyway={handleCompile}
            />
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
              <div className="flex-1 w-full h-full bg-canvas flex flex-col items-center justify-center relative">
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
                synctexMap={synctexMap ?? synctexMapRef.current}
                scale={scale}
                autoFit={autoFit}
                containerWidth={containerWidth}
                pageDimensions={pageDimensions}
                onPageDimensionsChange={handlePageDimensionsChange}
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
