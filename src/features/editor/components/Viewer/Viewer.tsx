'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePageStore } from '@/features/editor/store/page.store';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useCompileStore } from '@/features/editor/store/compile.store';
import {
  LatexCompilerEngine,
  type SyncTeXMap,
} from '@/features/editor/utils/viewer.util';
import { filesQuery, usePageActions } from '@/features/editor/hooks/use-page';
import type { Page as ProjectPage } from '@/features/editor/types/document.types';

import Toolbar from './Toolbar';
import Surface, { type SurfaceHandle } from './Surface';
import Logs, { parseLatexLog } from './Logs';
import Status from './Status';

export default function Viewer() {
  const {
    getEditorContent,
    compileRef,
    currentPage,
    gotoPageRef,
    pdfDocRef,
    scrollToPdfLineRef,
    scrollToLineRef,
    activeFilePage,
    setActiveFilePage,
  } = usePageStore();
  const { engine, compileMode, setCompileMode, mainFile, useCache } = useSettingsStore();

  const {
    compileStatus,
    setCompileStatus,
    compileLog,
    setCompileLog,
    setCompileErrors,
    pdfUrl,
    setPdfUrl,
    lastCompiledAt,
    setLastCompiledAt,
    pendingCompile,
    setPendingCompile,
    getDirtyFiles,
    clearAllDirty,
  } = useCompileStore();

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const { workspaceId, projectId, pageId: urlPageId } = useParams<{
    workspaceId?: string;
    projectId?: string;
    pageId: string;
  }>();
  const parentPageIdRef = useRef<string | null>(null);
  parentPageIdRef.current = urlPageId ?? null;
  const prevPdfUrlRef = useRef<string | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showLog, setShowLog] = useState(false);
  const [scrollMode] = useState(true);

  const [autoFit, setAutoFit] = useState(true);
  const [containerWidth, setContainerWidth] = useState(600);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;

    let isInitial = true;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth((prevWidth) => {
            if (!isInitial && prevWidth > 0 && Math.abs(prevWidth - w) > 2) {
              setAutoFit(true);
            }
            return w;
          });
          isInitial = false;
        }
      }
    });

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, [pdfUrl]);

  const fittedScale = useMemo(() => {
    const available = containerWidth - 48;
    const s = available / 595;
    return Math.max(0.5, Math.min(s, 2.5));
  }, [containerWidth]);

  useEffect(() => {
    if (autoFit) {
      setScale(fittedScale);
    }
  }, [autoFit, fittedScale]);

  const handleZoomIn = () => {
    setAutoFit(false);
    setScale((s) => Math.min(s + 0.15, 3.0));
  };

  const handleZoomOut = () => {
    setAutoFit(false);
    setScale((s) => Math.max(s - 0.15, 0.4));
  };

  const handleResetZoom = () => {
    setAutoFit(false);
    setScale(1.0);
  };

  const handleToggleAutoFit = () => {
    if (!autoFit) {
      setAutoFit(true);
      setScale(fittedScale);
    } else {
      setAutoFit(false);
    }
  };

  const showZoomGroup = containerWidth >= 480;
  const showUtilityGroup = containerWidth >= 380;

  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const pdfSurfaceRef = useRef<SurfaceHandle | null>(null);
  const synctexMapRef = useRef<SyncTeXMap | null>(null);

  const router = useRouter();
  const rootPageId = parentPageIdRef.current;
  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: !!rootPageId,
  });

  const findPageByBasename = (basename: string) => {
    const base = basename.replace(/\.tex$/, '').toLowerCase();
    return pageFiles.find((p: any) => p.title.replace(/\.tex$/, '').toLowerCase() === base);
  };

  // Compile runner using unified LatexCompilerEngine
  const handleCompile = async () => {
    const rootId = parentPageIdRef.current;
    if (!rootId) return;

    // Collect dirty file buffers
    const dirtyFiles = getDirtyFiles();
    const currentVal = getEditorContent.current?.();
    if (activeFilePage?._id && currentVal !== undefined) {
      const idx = dirtyFiles.findIndex((f) => f.fileId === activeFilePage._id);
      if (idx >= 0) dirtyFiles[idx].content = currentVal;
      else dirtyFiles.push({ fileId: activeFilePage._id, content: currentVal });
    }

    const res = await LatexCompilerEngine.compile({
      projectId: rootId,
      mainFile: mainFile || 'main.tex',
      engine: engine || 'pdflatex',
      draft: compileMode === 'draft',
      useCache,
      dirtyFiles,
      onPhaseChange: setCompileStatus,
      onThumbnailGenerated: (base64) => {
        saveThumbnailMutation.mutate({
          pageId: rootId,
          dataUrl: `data:image/jpeg;base64,${base64}`,
        });
      },
    });

    if (res.success) {
      if (
        prevPdfUrlRef.current &&
        prevPdfUrlRef.current.startsWith('blob:') &&
        prevPdfUrlRef.current !== res.pdfUrl
      ) {
        URL.revokeObjectURL(prevPdfUrlRef.current);
      }
      prevPdfUrlRef.current = res.pdfUrl;

      setPdfUrl(res.pdfUrl);
      synctexMapRef.current = res.synctexMap;
      setCompileLog(res.logs);
      setCompileStatus('done');
      setLastCompiledAt(res.compiledAt);
      setCompileErrors([]);
      clearAllDirty();
    } else {
      setCompileStatus('error');
      setCompileLog(res.logs);
      setCompileErrors(res.errors || []);
    }
  };

  // Force re-sync full project
  const handleForceSync = async () => {
    const rootId = parentPageIdRef.current;
    if (!rootId) return;

    setCompileStatus('syncing');
    try {
      await LatexCompilerEngine.forceSync(rootId);
      await handleCompile();
    } catch {
      setCompileStatus('error');
    }
  };

  // Expose compile trigger globally
  useEffect(() => {
    compileRef.current = handleCompile;
  }, [mainFile, engine, compileMode, useCache]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle pending compile trigger from auto-compile
  useEffect(() => {
    if (pendingCompile) {
      setPendingCompile(false);
      handleCompile();
    }
  }, [pendingCompile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevPage = () => setPageNumber((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setPageNumber((p) => Math.min(p + 1, numPages));

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = downloadRef.current || document.createElement('a');
    a.href = pdfUrl;
    a.download = `${currentPage?.title?.replace(/\s+/g, '_') || 'document'}.pdf`;
    a.click();
  };

  // Cleanup blob object URLs on unmount
  useEffect(() => {
    return () => {
      if (prevPdfUrlRef.current && prevPdfUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(prevPdfUrlRef.current);
      }
    };
  }, []);
  useEffect(() => {
    gotoPageRef.current = (page: number) => {
      const p = Math.max(1, Math.min(page, numPages || 1));
      setPageNumber(p);
      pdfSurfaceRef.current?.scrollToPage(p);
    };
    return () => {
      gotoPageRef.current = null;
    };
  }, [numPages]);

  // SyncTeX forward sync (Code cursor -> PDF highlight)
  useEffect(() => {
    scrollToPdfLineRef.current = (line: number) => {
      const targetPage = LatexCompilerEngine.resolveForward(
        line,
        synctexMapRef.current,
        activeFilePage?.title,
        numPages || 1,
      );

      if (targetPage !== null) {
        setPageNumber(targetPage);
        pdfSurfaceRef.current?.scrollToPage(targetPage);
      }
    };
    return () => {
      scrollToPdfLineRef.current = null;
    };
  }, [numPages, activeFilePage]);

  // SyncTeX reverse search (PDF double-click -> Code jump)
  const handleJumpToSource = (sourcePath: string | null, line: number) => {
    if (sourcePath) {
      const match = sourcePath.match(/(?:.*\/)?([^/]+\.tex)$/i);
      const filename = match ? match[1] : sourcePath;
      const matchedPage = findPageByBasename(filename);

      if (matchedPage && matchedPage._id !== activeFilePage?._id) {
        const rootId = parentPageIdRef.current;
        if (rootId) {
          const redirectUrl =
            workspaceId && projectId
              ? `/${workspaceId}/projects/${projectId}/pages/${rootId}?file=${matchedPage._id}`
              : `/editor/${rootId}?file=${matchedPage._id}`;

          setActiveFilePage(matchedPage as unknown as ProjectPage);
          router.push(redirectUrl);
          setTimeout(() => scrollToLineRef.current?.(line), 250);
          return;
        }
      }
    }

    scrollToLineRef.current?.(line);
  };

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  const onDocumentLoadSuccess = (pdf: any) => {
    pdfDocRef.current = pdf;
  };

  return (
    <div className="h-full flex flex-col bg-background border-l border-border select-none relative overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar
        compileStatus={compileStatus}
        engine={engine}
        compileMode={compileMode as 'full' | 'draft'}
        setCompileMode={(m) => setCompileMode(m as any)}
        onCompile={handleCompile}
        onForceSync={handleForceSync}
        scale={scale}
        autoFit={autoFit}
        showZoomGroup={showZoomGroup}
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
        showLog={showLog}
        showUtilityGroup={showUtilityGroup}
        onToggleLog={() => setShowLog((p) => !p)}
        onDownload={handleDownload}
      />

      <a ref={downloadRef} className="hidden" aria-hidden="true" />

      {/* PDF Viewer Surface */}
      <div ref={pdfContainerRef} className="flex-1 overflow-hidden relative flex flex-col">
        <Surface
          ref={pdfSurfaceRef}
          pdfUrl={pdfUrl}
          synctexMap={synctexMapRef.current}
          scale={scale}
          scrollMode={scrollMode}
          pageNumber={pageNumber}
          numPages={numPages}
          compileStatus={compileStatus}
          onPageNumberChange={setPageNumber}
          onNumPagesChange={setNumPages}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
          onJumpToSource={handleJumpToSource}
          onCompile={handleCompile}
        />

        {showLog && compileLog && <Logs log={compileLog} onClose={() => setShowLog(false)} />}
      </div>

      {/* Bottom Status Bar */}
      <Status
        compileStatus={compileStatus}
        lastCompiledAt={lastCompiledAt}
        pdfUrl={pdfUrl}
        parsedLog={parsedLog}
        onToggleLog={() => setShowLog((p) => !p)}
      />
    </div>
  );
}
