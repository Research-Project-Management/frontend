'use client';

/**
 * Viewer.tsx
 *
 * Deconstructed PDF Viewer container (Overleaf Parity):
 * - Composes usePdfZoom for viewport-aware scaling and shortcuts
 * - Composes usePdfCompiler for LaTeX compilation & diagnostics
 * - Composes useViewerSyncTeX for bidirectional cursor <-> page jumping
 * - Composes useViewerPopout for multi-monitor detached broadcasting
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import { filesQuery, usePageActions } from '@/features/editor/hooks/use-core';
import {
  extractPdfBookmarks,
  extractOutlineFromContent,
  type PdfOutlineItem,
} from '@/features/editor/utils/pdf-outline.util';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

import Toolbar from './Toolbar';
import Surface, { type SurfaceHandle } from './Surface';
import Logs, { parseLatexLog } from './Logs';
import DetachedViewerPlaceholder from './DetachedViewerPlaceholder';
import dynamic from 'next/dynamic';

const PresentationModeModal = dynamic(
  () => import('./subcomponents/PresentationModeModal'),
  { ssr: false }
);

import { usePdfZoom } from '../../sub-features/pdf-viewer/hooks/use-pdf-zoom';
import { usePdfCompiler } from '../../sub-features/compiler/hooks/use-pdf-compiler';
import { useViewerSyncTeX } from '../../sub-features/pdf-viewer/hooks/use-viewer-synctex';
import { useViewerPopout } from '../../sub-features/pdf-viewer/hooks/use-viewer-popout';
import { usePdfSearch, PdfFindBar } from '../../sub-features/pdf-viewer';

export default function Viewer() {
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

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: !!rootPageId,
  });

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfSurfaceRef = useRef<SurfaceHandle | null>(null);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [showLog, setShowLog] = useState(false);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [invertColors, setInvertColors] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  // 1. Compilation & Diagnostics Controller
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
    handleForceSync,
    handleStopCompilation,
  } = usePdfCompiler({
    projectId,
    pageId: rootPageId,
    saveThumbnailMutation,
  });

  // 2. Responsive Viewport Zoom & Scaling Controller
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
    numPages,
    pageNumber,
    setPageNumber,
    pdfSurfaceRef,
    synctexMapRef,
    pageFiles,
  });

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

  // 5. In-Document PDF Search Controller (Overleaf Parity)
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

  // F5 shortcut to launch Presentation mode when PDF is ready
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

  // Auto-switch to Logs panel on compile error and back to PDF on success (Overleaf parity)
  useEffect(() => {
    if (compileStatus === 'error') {
      setShowLog(true);
    } else if (compileStatus === 'done' && pdfUrl) {
      setShowLog(false);
    }
  }, [compileStatus, pdfUrl]);

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  const handleJumpToFirstError = useCallback(() => {
    const firstErr = parsedLog?.errors.find((e) => e.line !== undefined);
    if (firstErr && firstErr.line) {
      handleJumpToSource(firstErr.file || null, firstErr.line, undefined, undefined, undefined, 'error');
    } else {
      setShowLog(true);
    }
  }, [parsedLog, handleJumpToSource]);

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    pdfDocRef.current = pdf;

    try {
      const bookmarks = await extractPdfBookmarks(pdf);
      if (bookmarks && bookmarks.length > 0) {
        setPdfOutline(bookmarks);
        return;
      }
    } catch {
      // fallback below
    }

    const rawContent = editorEngine?.getContent() || usePageStore.getState().activeFilePage?.content || '';
    const content = typeof rawContent === 'string' ? rawContent : (rawContent as any)?.source || (rawContent as any)?.text || '';
    const fallback = extractOutlineFromContent(content, pdf.numPages || 1, synctexMapRef.current as any);
    setPdfOutline(fallback);
  }, [editorEngine, synctexMapRef]);

  const handlePrevPage = useCallback(() => setPageNumber((p) => Math.max(p - 1, 1)), []);
  const handleNextPage = useCallback(() => setPageNumber((p) => Math.min(p + 1, numPages)), [numPages]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = downloadRef.current || document.createElement('a');
    a.href = pdfUrl;
    a.download = `${documentTitle?.replace(/\s+/g, '_') || 'document'}.pdf`;
    a.click();
  }, [pdfUrl, documentTitle]);

  const handleToggleLog = useCallback(() => setShowLog((p) => !p), []);
  const handleToggleAutoCompile = useCallback(() => setAutoCompile(!autoCompile), [autoCompile, setAutoCompile]);
  const handleClearCacheAndCompile = useCallback(() => handleCompile({ forceClean: true }), [handleCompile]);
  const handleToggleInvertColors = useCallback(() => setInvertColors((v) => !v), []);
  const handleSetCompileMode = useCallback((m: 'full' | 'draft') => setCompileMode(m), [setCompileMode]);

  // If detached, show placeholder with toolbar controls
  if (isViewerPoppedOut) {
    return (
      <div className="h-full flex flex-col bg-background select-none relative min-h-0">
        <Toolbar
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
          showLog={false}
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
    <div className="h-full w-full flex flex-col bg-background select-none relative min-h-0">
      {showLog ? (
        <Logs
          log={compileLog || ''}
          onClose={() => setShowLog(false)}
          onJumpToError={(file, line) =>
            handleJumpToSource(file || null, line, undefined, undefined, undefined, 'error')
          }
          onClearCacheAndCompile={handleClearCacheAndCompile}
          onCompile={handleCompile}
        />
      ) : (
        <>
          <Toolbar
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
            showLog={showLog}
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
            <Surface
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
            />
          </div>
        </>
      )}

      {/* Presentation Mode Fullscreen Modal (Overleaf Parity) */}
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
