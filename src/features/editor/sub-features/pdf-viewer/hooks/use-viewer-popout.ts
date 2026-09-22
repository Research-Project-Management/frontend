'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useCompileStore, type CompileStatus } from '../../../store';
import { ViewerBroadcastBridge } from '../../../utils/popout-channel.util';

export interface UseViewerPopoutOptions {
  pageId: string | null;
  projectId?: string;
  pdfUrl: string | null;
  compileStatus: CompileStatus;
  compileLog: string;
  lastCompiledAt: Date | null;
  engine: string;
  compileMode: 'full' | 'draft';
  rawSynctex: string | null;
  handleCompile: () => void;
  handleForceSync: () => void;
  handleJumpToSource: (
    sourcePath: string | null,
    line: number,
    pageNum?: number,
    x?: number,
    y?: number,
  ) => void;
}

export function useViewerPopout({
  pageId,
  projectId,
  pdfUrl,
  compileStatus,
  compileLog,
  lastCompiledAt,
  engine,
  compileMode,
  rawSynctex,
  handleCompile,
  handleForceSync,
  handleJumpToSource,
}: UseViewerPopoutOptions) {
  const isViewerPoppedOut = useCompileStore((s) => s.isViewerPoppedOut);
  const setIsViewerPoppedOut = useCompileStore((s) => s.setIsViewerPoppedOut);

  const popupWinRef = useRef<Window | null>(null);
  const bridgeRef = useRef<ViewerBroadcastBridge | null>(null);

  const handlePopoutWindow = useCallback(() => {
    if (!pageId) return;

    const url = projectId
      ? `/projects/${projectId}/pages/${pageId}/popout`
      : `/editor/${pageId}/popout`;

    const width = Math.min(1000, window.screen.availWidth - 100);
    const height = Math.min(1100, window.screen.availHeight - 100);
    const left = window.screenX + 60;
    const top = window.screenY + 40;

    const popup = window.open(
      url,
      `FluxPdfViewer_${pageId}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`,
    );

    if (popup) {
      popupWinRef.current = popup;
      setIsViewerPoppedOut(true);
    }
  }, [pageId, projectId, setIsViewerPoppedOut]);

  const handleReattach = useCallback(() => {
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
  }, [setIsViewerPoppedOut]);

  const handleFocusPopout = useCallback(() => {
    if (popupWinRef.current && !popupWinRef.current.closed) {
      popupWinRef.current.focus();
    }
  }, []);

  // Cross-window communication bridge setup
  useEffect(() => {
    if (!pageId) return;

    const bridge = new ViewerBroadcastBridge(pageId);
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
            rawSynctex,
            projectId: projectId || undefined,
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
  }, [pageId, engine, compileMode, handleCompile, handleForceSync, handleJumpToSource, setIsViewerPoppedOut]); // eslint-disable-line react-hooks/exhaustive-deps

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
          rawSynctex,
          projectId: projectId || undefined,
        },
      });
    }
  }, [pdfUrl, compileStatus, compileLog, lastCompiledAt, isViewerPoppedOut, engine, compileMode, rawSynctex, projectId]);

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

  return {
    isViewerPoppedOut,
    handlePopoutWindow,
    handleReattach,
    handleFocusPopout,
  };
}
