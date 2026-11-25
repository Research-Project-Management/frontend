'use client';

/**
 * DetachedPdfViewer.tsx
 *
 * Detached PDF Preview Component (Overleaf Parity: Pop-out Window).
 * Location: `features/editor/subsystems/compiler/ui/DetachedPdfViewer.tsx`
 *
 * Runs full-screen PDF.js viewer in an independent tab/window,
 * linked with the main editor via BroadcastChannel('flux-synctex-bus').
 */

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { logger } from '@/shared/lib/logger';
import { useParams, useSearchParams } from 'next/navigation';
import {
  editorCommandBus,
  useWorkspaceStore,
  getSyncTexChannelName,
} from '@/features/editor/core';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler';
import { useCompileStore } from '../../store/compiler.store';

const PdfViewer = dynamic(
  () => import('./PdfViewer'),
  { ssr: false }
);

export function DetachedPdfViewer() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const searchParams = useSearchParams();
  const targetId =
    searchParams?.get('pageId') || params?.pageId || params?.projectId || null;

  useEffect(() => {
    useWorkspaceStore.getState().setPdfDetached(true);
    useCompileStore.getState().setIsViewerPoppedOut(true);

    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channelName = getSyncTexChannelName(targetId);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(channelName);
      channel.onmessage = (event) => {
        const msgTarget = (event.data as { targetId?: unknown } | undefined)?.targetId;
        if (typeof msgTarget === 'string' && msgTarget.length > 0 && targetId && msgTarget !== targetId) {
          return;
        }
        const { type, payload } = event.data || {};
        if (type === 'preview:attached') {
          window.close();
        } else if (type === 'synctex:forward' && payload?.line) {
          editorCommandBus.dispatch({
            type: 'synctex:forward',
            line: payload.line,
            column: payload.column,
            filePath: payload.filePath,
            fileId: payload.fileId,
          });
        } else if (type === 'viewer:jump-to-line' && payload?.line) {
          editorCommandBus.dispatch({
            type: 'viewer:jump-to-line',
            line: payload.line,
          });
        } else if (type === 'viewer:goto-page' && payload?.page) {
          editorCommandBus.dispatch({
            type: 'viewer:goto-page',
            page: payload.page,
          });
        } else if (type === 'sync:editor-scrolled' && payload?.line) {
          editorCommandBus.dispatch({
            type: 'sync:editor-scrolled',
            line: payload.line,
            totalLines: payload.totalLines,
            fraction: payload.fraction,
          });
        } else if ((type === 'compiler:sync-state' || type === 'compiler:result') && payload) {
          if (payload.pdfUrl) {
            useCompileStore.getState().setPdfUrl(payload.pdfUrl);
          }
          if (payload.compileStatus) {
            useCompileStore.getState().setCompileStatus(payload.compileStatus);
          }
          if (payload.logs) {
            useCompileStore.getState().setCompileLog(payload.logs);
          }
          if (payload.lastCompiledAt) {
            useCompileStore.getState().setLastCompiledAt(new Date(payload.lastCompiledAt));
          }
          if (payload.synctexMap) {
            compilerCoordinator.setSynctexMap(payload.synctexMap);
            editorCommandBus.dispatch({
              type: 'synctex:map-updated',
              map: payload.synctexMap,
            });
          }
        }
      };

      // Query main window for initial PDF and compiler state
      channel.postMessage({ type: 'preview:ready', ...(targetId ? { targetId } : {}) });
    } catch (err) {
      logger.warn('[DetachedPreview] BroadcastChannel failed to initialize', { error: err });
    }

    // Forward local PDF dual-scroll movements back to main window editor
    const unsubScroll = editorCommandBus.subscribe('editor:scroll-to-line', (cmd) => {
      channel?.postMessage({
        type: 'editor:scroll-to-line',
        ...(targetId ? { targetId } : {}),
        payload: { line: cmd.line, smooth: cmd.smooth },
      });
    });

    const handleBeforeUnload = () => {
      try {
        channel?.postMessage({ type: 'preview:window-closed', ...(targetId ? { targetId } : {}) });
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubScroll();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      try {
        channel?.postMessage({ type: 'preview:window-closed', ...(targetId ? { targetId } : {}) });
        channel?.close();
      } catch {}
    };
  }, [targetId]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <main className="flex-1 min-h-0 min-w-0 w-full h-full relative">
        <PdfViewer isDetached />
      </main>
    </div>
  );
}

export default DetachedPdfViewer;
