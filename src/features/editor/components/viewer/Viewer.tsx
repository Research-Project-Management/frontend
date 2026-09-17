'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePageStore, useSettingsStore, useCompileStore } from '@/features/editor/store';
import {
  LatexCompilerEngine,
  type SyncTeXMap,
} from '@/features/editor/utils/viewer.util';
import { ViewerBroadcastBridge } from '@/features/editor/utils/popout-channel.util';
import { filesQuery, usePageActions } from '@/features/editor/hooks/use-core';
import { versionService } from '@/features/editor/services/history.service';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { Page as ProjectPage } from '@/features/editor/types';
import {
  extractPdfBookmarks,
  extractOutlineFromContent,
  type PdfOutlineItem,
} from '@/features/editor/utils/pdf-outline.util';

import Toolbar from './Toolbar';
import Surface, { type SurfaceHandle } from './Surface';
import Logs, { parseLatexLog } from './Logs';
import Status from './Status';
import DetachedViewerPlaceholder from './DetachedViewerPlaceholder';

export default function Viewer() {
  const lastCheckpointTimeRef = useRef<number>(0);
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
  const {
    engine,
    setEngine,
    compileMode,
    setCompileMode,
    mainFile,
    useCache,
    autoCompile,
    setAutoCompile,
    texLiveVersion,
  } = useSettingsStore();

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
    clearDirty,
    clearAllDirty,
    isViewerPoppedOut,
    setIsViewerPoppedOut,
  } = useCompileStore();

  const { updateThumbnail: saveThumbnailMutation } = usePageActions();

  const { projectId, pageId: urlPageId } = useParams<{
    projectId?: string;
    pageId: string;
  }>();
  const parentPageIdRef = useRef<string | null>(null);
  parentPageIdRef.current = urlPageId ?? null;
  const prevPdfUrlRef = useRef<string | null>(null);
  const popupWinRef = useRef<Window | null>(null);
  const bridgeRef = useRef<ViewerBroadcastBridge | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showLog, setShowLog] = useState(false);
  const [scrollMode] = useState(true);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [invertColors, setInvertColors] = useState(false);

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
    setAutoFit((prev) => {
      const next = !prev;
      if (next) setScale(fittedScale);
      return next;
    });
  };

  useEffect(() => {
    const unsubZoomIn = EditorEventBus.on('flux:zoom-in', handleZoomIn);
    const unsubZoomOut = EditorEventBus.on('flux:zoom-out', handleZoomOut);
    const unsubFitWidth = EditorEventBus.on('flux:zoom-fit-width', () => {
      setAutoFit(true);
      setScale(fittedScale);
    });
    const unsubFitHeight = EditorEventBus.on('flux:zoom-fit-height', () => {
      setAutoFit(false);
      setScale(0.85);
    });
    return () => {
      unsubZoomIn();
      unsubZoomOut();
      unsubFitWidth();
      unsubFitHeight();
    };
  }, [fittedScale]);

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
    const cleanName = basename.replace(/^\.\//, '').toLowerCase();
    const baseNoExt = cleanName.replace(/\.(tex|bib|sty|cls)$/i, '');
    return pageFiles.find((p: any) => {
      const titleLower = (p.title || '').toLowerCase();
      return (
        titleLower === cleanName ||
        titleLower.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt
      );
    });
  };

  // Compile runner using unified LatexCompilerEngine
  const handleCompile = async (options?: { forceClean?: boolean }) => {
    const rootId = parentPageIdRef.current;
    if (!rootId) return;

    // Collect dirty file buffers
    const dirtyFiles = getDirtyFiles();
    const currentVal = getEditorContent.current?.();
    if (activeFilePage?.id && currentVal !== undefined) {
      const idx = dirtyFiles.findIndex((f) => f.fileId === activeFilePage.id);
      if (idx >= 0) dirtyFiles[idx].content = currentVal;
      else dirtyFiles.push({ fileId: activeFilePage.id, content: currentVal });
    }

    const effectiveProjectId = currentPage?.projectId || projectId || '';
    const res = await LatexCompilerEngine.compile({
      projectId: effectiveProjectId,
      pageId: rootId,
      mainFile: mainFile || 'main.tex',
      engine: engine || 'pdflatex',
      texLiveVersion,
      draft: compileMode === 'draft',
      useCache: options?.forceClean ? false : useCache,
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

      // Granular dirty clearing: only clear files that were successfully saved
      if (res.flushedFileIds && res.flushedFileIds.length > 0) {
        res.flushedFileIds.forEach((fid) => clearDirty(fid));

        // Auto-checkpoint on successful compile (throttled to at most once per 60s)
        const now = Date.now();
        if (now - lastCheckpointTimeRef.current > 60000 && activeFilePage?.id) {
          lastCheckpointTimeRef.current = now;
          versionService
            .save({
              pageId: activeFilePage.id,
              label: 'Compile checkpoint',
              eventType: 'auto_save',
              fileName: activeFilePage.title || 'main.tex',
              rootPageId: rootId,
            })
            .catch(() => {});
        }
      } else if (!res.flushErrors || res.flushErrors.length === 0) {
        clearAllDirty();
      }
    } else {
      setCompileStatus('error');
      setCompileLog(res.logs);
      setCompileErrors(res.errors || []);

      // If any files were successfully flushed, clear their dirty state; failed ones stay dirty
      if (res.flushedFileIds && res.flushedFileIds.length > 0) {
        res.flushedFileIds.forEach((fid) => clearDirty(fid));
      }
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
  }, [numPages, gotoPageRef]);

  // SyncTeX forward sync (Code cursor -> PDF highlight)
  useEffect(() => {
    scrollToPdfLineRef.current = async (line: number) => {
      const rootId = parentPageIdRef.current || projectId || 'default';
      const filename = activeFilePage?.title || 'main.tex';

      // 1. Try Backend Single Source of Truth
      const remoteRes = await LatexCompilerEngine.resolveForwardRemote(
        rootId,
        filename,
        line,
      );

      let targetPage = remoteRes?.page ?? null;
      let targetX = remoteRes ? remoteRes.x * scale : undefined;
      let targetY = remoteRes ? remoteRes.y * scale : undefined;

      if (!targetPage) {
        const localDetail = LatexCompilerEngine.resolveForwardDetail(
          line,
          synctexMapRef.current,
          activeFilePage?.title,
          numPages || 1,
        );
        if (localDetail) {
          targetPage = localDetail.page;
          if (localDetail.x !== undefined && localDetail.y !== undefined) {
            targetX = (localDetail.x / 65536) * scale;
            targetY = (localDetail.y / 65536) * scale;
          }
        }
      }

      if (targetPage !== null) {
        setPageNumber(targetPage);
        if (targetX !== undefined && targetY !== undefined) {
          pdfSurfaceRef.current?.highlightTarget?.(targetPage, targetX, targetY);
        } else {
          pdfSurfaceRef.current?.scrollToPage(targetPage);
        }

        if (bridgeRef.current) {
          bridgeRef.current.postMessage({
            type: 'FORWARD_SYNC',
            page: targetPage,
            line,
          });
        }
      }
    };
    return () => {
      scrollToPdfLineRef.current = null;
    };
  }, [numPages, activeFilePage, scrollToPdfLineRef, projectId, scale]);

  // SyncTeX reverse search (PDF double-click -> Code jump)
  const handleJumpToSource = async (
    sourcePath: string | null,
    line: number,
    pageNum?: number,
    x?: number,
    y?: number,
  ) => {
    const rootId = parentPageIdRef.current || projectId || 'default';

    // 1. Try local resolution first if line is missing or default
    if ((!sourcePath || !line || line <= 1) && synctexMapRef.current && pageNum !== undefined) {
      const clickFraction = y !== undefined ? Math.max(0, Math.min(1, y / 842)) : 0;
      const local = LatexCompilerEngine.resolveReverse(
        clickFraction,
        pageNum,
        synctexMapRef.current,
        x,
        y,
      );
      if (local?.line) {
        sourcePath = local.sourcePath;
        line = local.line;
      }
    }

    // 2. Fallback to Backend Single Source of Truth if still unresolved
    if ((!sourcePath || !line || line <= 1) && pageNum !== undefined && x !== undefined && y !== undefined) {
      const remoteJump = await LatexCompilerEngine.resolveReverseRemote(
        rootId,
        pageNum,
        x,
        y,
      );
      if (remoteJump) {
        sourcePath = remoteJump.sourcePath;
        line = remoteJump.line;
      }
    }

    if (sourcePath) {
      const match = sourcePath.match(/(?:.*\/)?([^/]+\.[a-zA-Z0-9]+)$/i);
      const filename = match ? match[1] : sourcePath;
      const matchedPage = findPageByBasename(filename);

      if (matchedPage && matchedPage.id !== activeFilePage?.id && rootId) {
        const redirectUrl = projectId
          ? `/projects/${projectId}/pages/${rootId}?file=${matchedPage.id}`
          : `/editor/${rootId}?file=${matchedPage.id}`;

        setActiveFilePage(matchedPage as unknown as ProjectPage);
        router.push(redirectUrl);
        setTimeout(() => scrollToLineRef.current?.(line), 250);
        return;
      }
    }

    scrollToLineRef.current?.(line);
  };

  // SyncTeX reverse search event listener (Floating widget backward arrow)
  useEffect(() => {
    return EditorEventBus.on('flux:synctex-backward', () => {
      const p = pageNumber || 1;
      const resolved = synctexMapRef.current
        ? LatexCompilerEngine.resolveReverse(0.25, p, synctexMapRef.current)
        : null;
      if (resolved?.line) {
        handleJumpToSource(resolved.sourcePath, resolved.line, p);
      } else {
        handleJumpToSource(null, 1, p, 200, 200);
      }
    });
  }, [pageNumber, handleJumpToSource]);

  const handleJumpToFirstError = () => {
    const firstErr = parsedLog?.errors.find((e) => e.line !== undefined);
    if (firstErr && firstErr.line) {
      handleJumpToSource(firstErr.file || null, firstErr.line);
    } else {
      setShowLog(true);
    }
  };

  const handlePopoutWindow = () => {
    const rootId = parentPageIdRef.current;
    if (!rootId) return;

    const url = projectId
      ? `/projects/${projectId}/pages/${rootId}/popout`
      : `/editor/${rootId}/popout`;

    const width = Math.min(1000, window.screen.availWidth - 100);
    const height = Math.min(1100, window.screen.availHeight - 100);
    const left = window.screenX + 60;
    const top = window.screenY + 40;

    const popup = window.open(
      url,
      `FluxPdfViewer_${rootId}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`,
    );

    if (popup) {
      popupWinRef.current = popup;
      setIsViewerPoppedOut(true);
    }
  };

  const handleReattach = () => {
    bridgeRef.current?.postMessage({ type: 'REATTACH_REQUEST' });
    if (popupWinRef.current && !popupWinRef.current.closed) {
      try {
        popupWinRef.current.close();
      } catch {
        // ignore
      }
    }
    popupWinRef.current = null;
    setIsViewerPoppedOut(false);
  };

  const handleFocusPopout = () => {
    if (popupWinRef.current && !popupWinRef.current.closed) {
      popupWinRef.current.focus();
    }
  };

  // Cross-window communication bridge setup
  useEffect(() => {
    const rootId = parentPageIdRef.current;
    if (!rootId) return;

    const bridge = new ViewerBroadcastBridge(rootId);
    bridgeRef.current = bridge;

    const unsubscribe = bridge.subscribe((msg) => {
      if (msg.type === 'VIEWER_READY') {
        bridge.postMessage({
          type: 'SYNC_STATE',
          state: {
            pdfUrl,
            compileStatus,
            compileLog,
            lastCompiledAt: lastCompiledAt ? lastCompiledAt.toISOString() : null,
            engine,
            compileMode,
          },
        });
      } else if (msg.type === 'REQUEST_COMPILE') {
        handleCompile();
      } else if (msg.type === 'REQUEST_FORCE_SYNC') {
        handleForceSync();
      } else if (msg.type === 'REVERSE_SYNC') {
        handleJumpToSource(msg.sourcePath, msg.line, msg.pageNum, msg.x, msg.y);
      } else if (msg.type === 'REATTACH_REQUEST' || msg.type === 'WINDOW_CLOSED') {
        setIsViewerPoppedOut(false);
        popupWinRef.current = null;
      }
    });

    return () => {
      unsubscribe();
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, [parentPageIdRef.current, engine, compileMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast latest compile state to popout window
  useEffect(() => {
    if (bridgeRef.current && isViewerPoppedOut) {
      bridgeRef.current.postMessage({
        type: 'SYNC_STATE',
        state: {
          pdfUrl,
          compileStatus,
          compileLog,
          lastCompiledAt: lastCompiledAt ? lastCompiledAt.toISOString() : null,
          engine,
          compileMode,
        },
      });
    }
  }, [pdfUrl, compileStatus, compileLog, lastCompiledAt, isViewerPoppedOut, engine, compileMode]);

  // Monitor popup window closure
  useEffect(() => {
    if (!isViewerPoppedOut) return;

    const interval = setInterval(() => {
      if (popupWinRef.current && popupWinRef.current.closed) {
        setIsViewerPoppedOut(false);
        popupWinRef.current = null;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isViewerPoppedOut, setIsViewerPoppedOut]);

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  const onDocumentLoadSuccess = async (pdf: any) => {
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

    const content = getEditorContent.current?.() || activeFilePage?.content || '';
    const fallback = extractOutlineFromContent(content, pdf.numPages || 1, synctexMapRef.current as any);
    setPdfOutline(fallback);
  };

  const handleJumpToPage = (targetPage: number) => {
    const p = Math.max(1, Math.min(targetPage, numPages || 1));
    setPageNumber(p);
    pdfSurfaceRef.current?.scrollToPage(p);
  };

  // If detached, show placeholder with toolbar controls
  if (isViewerPoppedOut) {
    return (
      <div className="h-full flex flex-col bg-background border-l border-border select-none relative overflow-hidden">
        <Toolbar
          compileStatus={compileStatus}
          engine={engine}
          setEngine={setEngine}
          compileMode={compileMode as 'full' | 'draft'}
          setCompileMode={(m) => setCompileMode(m as any)}
          autoCompile={autoCompile}
          onToggleAutoCompile={() => setAutoCompile(!autoCompile)}
          onClearCacheAndCompile={() => handleCompile({ forceClean: true })}
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
          onToggleLog={() => setShowLog((p) => !p)}
          onDownload={handleDownload}
          onPopout={handleReattach}
          isPoppedOut={true}
          outline={pdfOutline}
          onJumpToPage={handleJumpToPage}
          invertColors={invertColors}
          onToggleInvertColors={() => setInvertColors((v) => !v)}
          onSetScale={(s) => {
            setAutoFit(false);
            setScale(s);
          }}
        />

        <div className="flex-1 overflow-hidden relative flex flex-col">
          <DetachedViewerPlaceholder
            onReattach={handleReattach}
            onFocusWindow={handleFocusPopout}
            compileStatus={compileStatus}
            lastCompiledAt={lastCompiledAt}
          />
        </div>

        <Status
          compileStatus={compileStatus}
          lastCompiledAt={lastCompiledAt}
          pdfUrl={pdfUrl}
          parsedLog={parsedLog}
          onToggleLog={() => setShowLog((p) => !p)}
          onJumpToFirstError={handleJumpToFirstError}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background border-l border-border select-none relative overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar
        compileStatus={compileStatus}
        engine={engine}
        setEngine={setEngine}
        compileMode={compileMode as 'full' | 'draft'}
        setCompileMode={(m) => setCompileMode(m as any)}
        autoCompile={autoCompile}
        onToggleAutoCompile={() => setAutoCompile(!autoCompile)}
        onClearCacheAndCompile={() => handleCompile({ forceClean: true })}
        onCompile={handleCompile}
        onForceSync={handleForceSync}
        scale={scale}
        autoFit={autoFit}
        showZoomGroup={showZoomGroup}
        onToggleAutoFit={handleToggleAutoFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onSetScale={(s) => {
          setAutoFit(false);
          setScale(s);
        }}
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
        onPopout={handlePopoutWindow}
        isPoppedOut={false}
        outline={pdfOutline}
        onJumpToPage={handleJumpToPage}
        invertColors={invertColors}
        onToggleInvertColors={() => setInvertColors((v) => !v)}
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
          invertColors={invertColors}
        />

        {showLog && compileLog && (
          <Logs
            log={compileLog}
            onClose={() => setShowLog(false)}
            onJumpToError={(file, line) => handleJumpToSource(file || null, line)}
          />
        )}
      </div>

      {/* Bottom Status Bar */}
      <Status
        compileStatus={compileStatus}
        lastCompiledAt={lastCompiledAt}
        pdfUrl={pdfUrl}
        parsedLog={parsedLog}
        onToggleLog={() => setShowLog((p) => !p)}
        onJumpToFirstError={handleJumpToFirstError}
      />
    </div>
  );
}
