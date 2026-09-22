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
import Status from './Status';
import DetachedViewerPlaceholder from './DetachedViewerPlaceholder';
import PresentationModeModal from './subcomponents/PresentationModeModal';

import { usePdfZoom } from '../../sub-features/pdf-viewer/hooks/use-pdf-zoom';
import { usePdfCompiler } from '../../sub-features/compiler/hooks/use-pdf-compiler';
import { useViewerSyncTeX } from '../../sub-features/pdf-viewer/hooks/use-viewer-synctex';
import { useViewerPopout } from '../../sub-features/pdf-viewer/hooks/use-viewer-popout';

export default function Viewer() {
  const { projectId, pageId: urlPageId } = useParams<{
    projectId?: string;
    pageId: string;
  }>();

  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const { engine: editorEngine } = useEditorInstance();
  const pdfDocRef = useRef<any>(null);

  const pdfSpreadView = useSettingsStore((s) => s.pdfSpreadView);
  const togglePdfSpreadView = useSettingsStore((s) => s.togglePdfSpreadView);

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const rootPageId = urlPageId ?? null;
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

    const content = editorEngine?.getContent() || activeFilePage?.content || '';
    const fallback = extractOutlineFromContent(content, pdf.numPages || 1, synctexMapRef.current as any);
    setPdfOutline(fallback);
  }, [editorEngine, activeFilePage?.content, synctexMapRef]);

  const handlePrevPage = useCallback(() => setPageNumber((p) => Math.max(p - 1, 1)), []);
  const handleNextPage = useCallback(() => setPageNumber((p) => Math.min(p + 1, numPages)), [numPages]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = downloadRef.current || document.createElement('a');
    a.href = pdfUrl;
    a.download = `${currentPage?.title?.replace(/\s+/g, '_') || 'document'}.pdf`;
    a.click();
  }, [pdfUrl, currentPage?.title]);

  const handleToggleLog = useCallback(() => setShowLog((p) => !p), []);
  const handleToggleAutoCompile = useCallback(() => setAutoCompile(!autoCompile), [autoCompile, setAutoCompile]);
  const handleClearCacheAndCompile = useCallback(() => handleCompile({ forceClean: true }), [handleCompile]);
  const handleToggleInvertColors = useCallback(() => setInvertColors((v) => !v), []);
  const handleSetCompileMode = useCallback((m: 'full' | 'draft') => setCompileMode(m), [setCompileMode]);

  // If detached, show placeholder with toolbar controls
  if (isViewerPoppedOut) {
    return (
      <div className="h-full flex flex-col bg-background border-l border-border select-none relative overflow-hidden">
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
        />
        <DetachedViewerPlaceholder
          compileStatus={compileStatus}
          lastCompiledAt={lastCompiledAt}
          onReattach={handleReattach}
          onFocusWindow={handleFocusPopout}
        />
        <Status
          compileStatus={compileStatus}
          lastCompiledAt={lastCompiledAt}
          pdfUrl={pdfUrl}
          parsedLog={parsedLog}
          onToggleLog={handleToggleLog}
          onJumpToFirstError={handleJumpToFirstError}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background border-l border-border select-none relative overflow-hidden">
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
        onOpenPresentationMode={() => setIsPresentationOpen(true)}
      />

      <a ref={downloadRef} className="hidden" aria-hidden="true" />

      {/* PDF Viewer Surface */}
      <div ref={pdfContainerRef} className="flex-1 overflow-hidden relative flex flex-col">
        <Surface
          ref={pdfSurfaceRef}
          pdfUrl={pdfUrl}
          synctexMap={synctexMapRef.current}
          scale={scale}
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

        {showLog && compileLog && (
          <Logs
            log={compileLog}
            onClose={() => setShowLog(false)}
            onJumpToError={(file, line) =>
              handleJumpToSource(file || null, line, undefined, undefined, undefined, 'error')
            }
            onClearCacheAndCompile={handleClearCacheAndCompile}
          />
        )}
      </div>

      {/* Bottom Status Bar */}
      <Status
        compileStatus={compileStatus}
        lastCompiledAt={lastCompiledAt}
        pdfUrl={pdfUrl}
        parsedLog={parsedLog}
        onToggleLog={handleToggleLog}
        onJumpToFirstError={handleJumpToFirstError}
      />

      {/* Presentation Mode Fullscreen Modal (Overleaf Parity) */}
      <PresentationModeModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        pdfUrl={pdfUrl}
        initialPage={pageNumber}
        numPages={numPages}
        onPageChange={setPageNumber}
      />
    </div>
  );
}
