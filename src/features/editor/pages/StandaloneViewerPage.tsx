'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ViewerBroadcastBridge,
  type PopoutViewerState,
} from '@/features/editor/utils/popout-channel.util';
import {
  extractPdfBookmarks,
  type PdfOutlineItem,
} from '@/features/editor/utils/pdf-outline.util';
import Toolbar from '../components/viewer/Toolbar';
import Surface, { type SurfaceHandle } from '../components/viewer/Surface';
import Logs, { parseLatexLog } from '../components/viewer/Logs';
import Status from '../components/viewer/Status';
import type { CompileStatus, LaTeXEngine } from '@/features/editor/store';

export default function StandaloneViewerPage() {
  const { pageId } = useParams<{ pageId: string }>();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
  const [compileLog, setCompileLog] = useState<string>('');
  const [lastCompiledAt, setLastCompiledAt] = useState<Date | null>(null);
  const [engine, setEngine] = useState<LaTeXEngine>('pdflatex');
  const [compileMode, setCompileMode] = useState<'full' | 'draft'>('full');

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [showLog, setShowLog] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<SurfaceHandle | null>(null);
  const bridgeRef = useRef<ViewerBroadcastBridge | null>(null);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  // ResizeObserver for auto-fit zoom calculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isInitial = true;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth((prev) => {
            if (!isInitial && prev > 0 && Math.abs(prev - w) > 2) {
              setAutoFit(true);
            }
            return w;
          });
          isInitial = false;
        }
      }
    });

    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

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

  // Set up BroadcastChannel communication with main editor window
  useEffect(() => {
    if (!pageId) return;

    const bridge = new ViewerBroadcastBridge(pageId);
    bridgeRef.current = bridge;

    const unsubscribe = bridge.subscribe((msg) => {
      if (msg.type === 'SYNC_STATE') {
        const s = msg.state;
        if (s.pdfUrl !== undefined) setPdfUrl(s.pdfUrl);
        if (s.compileStatus !== undefined) setCompileStatus(s.compileStatus);
        if (s.compileLog !== undefined) setCompileLog(s.compileLog || '');
        if (s.lastCompiledAt) setLastCompiledAt(new Date(s.lastCompiledAt));
        if (s.engine) setEngine(s.engine as LaTeXEngine);
        if (s.compileMode) setCompileMode(s.compileMode);
      } else if (msg.type === 'FORWARD_SYNC') {
        if (msg.page) {
          setPageNumber(msg.page);
          surfaceRef.current?.scrollToPage(msg.page);
        }
      } else if (msg.type === 'REATTACH_REQUEST') {
        window.close();
      }
    });

    // Notify main editor window that popout viewer is ready to receive state
    bridge.postMessage({ type: 'VIEWER_READY' });

    const handleBeforeUnload = () => {
      bridge.postMessage({ type: 'WINDOW_CLOSED' });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      bridge.postMessage({ type: 'WINDOW_CLOSED' });
      unsubscribe();
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, [pageId]);

  // Zoom handlers
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

  // Compile request to main editor window
  const handleCompile = () => {
    setCompileStatus('compiling');
    bridgeRef.current?.postMessage({ type: 'REQUEST_COMPILE' });
  };

  const handleForceSync = () => {
    setCompileStatus('syncing');
    bridgeRef.current?.postMessage({ type: 'REQUEST_FORCE_SYNC' });
  };

  // Reverse SyncTeX (double click PDF -> jump code in main editor)
  const handleJumpToSource = (
    sourcePath: string | null,
    line: number,
    pageNum?: number,
    x?: number,
    y?: number,
  ) => {
    bridgeRef.current?.postMessage({
      type: 'REVERSE_SYNC',
      sourcePath,
      line,
      pageNum,
      x,
      y,
    });
  };

  // Re-attach to main editor
  const handleReattach = () => {
    bridgeRef.current?.postMessage({ type: 'REATTACH_REQUEST' });
    window.close();
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = downloadRef.current || document.createElement('a');
    a.href = pdfUrl;
    a.download = `document.pdf`;
    a.click();
  };

  const handleJumpToPage = (pageNum: number) => {
    setPageNumber(pageNum);
    surfaceRef.current?.scrollToPage(pageNum);
  };

  const handleDocumentLoadSuccess = async (pdf: any) => {
    try {
      const bookmarks = await extractPdfBookmarks(pdf);
      if (bookmarks && bookmarks.length > 0) {
        setOutline(bookmarks);
      }
    } catch {
      // ignore
    }
  };

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-background select-none overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar
        compileStatus={compileStatus}
        engine={engine}
        compileMode={compileMode}
        setCompileMode={setCompileMode}
        onCompile={handleCompile}
        onForceSync={handleForceSync}
        scale={scale}
        autoFit={autoFit}
        showZoomGroup={containerWidth >= 480}
        onToggleAutoFit={handleToggleAutoFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        pageNumber={pageNumber}
        numPages={numPages}
        onPrevPage={() => setPageNumber((p) => Math.max(p - 1, 1))}
        onNextPage={() => setPageNumber((p) => Math.min(p + 1, numPages))}
        pdfUrl={pdfUrl}
        compileLog={compileLog}
        showLog={showLog}
        showUtilityGroup={containerWidth >= 380}
        onToggleLog={() => setShowLog((p) => !p)}
        onDownload={handleDownload}
        onPopout={handleReattach}
        isPoppedOut={true}
        outline={outline}
        onJumpToPage={handleJumpToPage}
      />

      <a ref={downloadRef} className="hidden" aria-hidden="true" />

      {/* Surface */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative flex flex-col">
        <Surface
          ref={surfaceRef}
          pdfUrl={pdfUrl}
          synctexMap={null}
          scale={scale}
          scrollMode={true}
          pageNumber={pageNumber}
          numPages={numPages}
          compileStatus={compileStatus}
          onPageNumberChange={setPageNumber}
          onNumPagesChange={setNumPages}
          onDocumentLoadSuccess={handleDocumentLoadSuccess}
          onJumpToSource={handleJumpToSource}
          onCompile={handleCompile}
        />

        {showLog && compileLog && <Logs log={compileLog} onClose={() => setShowLog(false)} />}
      </div>

      {/* Status Bar */}
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
