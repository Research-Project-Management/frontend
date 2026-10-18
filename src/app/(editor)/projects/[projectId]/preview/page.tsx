'use client';

/**
 * Detached PDF Preview Page (Overleaf Parity: Pop-out Window).
 * Location: `app/(editor)/projects/[projectId]/preview/page.tsx`
 *
 * Runs full-screen PDF.js viewer in an independent tab/window,
 * linked with the main editor via BroadcastChannel('flux-synctex-bus').
 */

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  editorCommandBus,
  useCompileStore,
  useLayoutStore,
} from '@/features/editor/core';

const PdfViewer = dynamic(
  () => import('@/features/editor/subsystems/compiler').then((mod) => mod.PdfViewer),
  { ssr: false }
);

export default function DetachedPdfPreviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  useEffect(() => {
    useLayoutStore.getState().setPdfDetached(true);

    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('flux-synctex-bus');
      channel.onmessage = (event) => {
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
        } else if (type === 'compiler:sync-state' && payload) {
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
        }
      };

      // Query main window for initial PDF and compiler state
      channel.postMessage({ type: 'preview:ready' });
    } catch (err) {
      console.warn('[DetachedPreview] BroadcastChannel failed to initialize:', err);
    }

    // Forward local PDF dual-scroll movements back to main window editor
    const unsubScroll = editorCommandBus.subscribe('editor:scroll-to-line', (cmd) => {
      channel?.postMessage({
        type: 'editor:scroll-to-line',
        payload: { line: cmd.line, smooth: cmd.smooth },
      });
    });

    const handleBeforeUnload = () => {
      try {
        channel?.postMessage({ type: 'preview:window-closed' });
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubScroll();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      try {
        channel?.postMessage({ type: 'preview:window-closed' });
        channel?.close();
      } catch {}
    };
  }, []);

  const handleReattach = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('flux-synctex-bus');
        channel.postMessage({ type: 'preview:attached' });
        channel.close();
      } catch {
        // BroadcastChannel fallback
      }
    }
    editorCommandBus.dispatch({ type: 'preview:attach' });
    window.close();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* ── Detached Preview Top Bar ── */}
      <header className="h-10 border-b border-border bg-secondary/40 px-3 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground tracking-tight">Flux PDF Preview</span>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            Detached Window
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReattach}
          className="h-7 text-xs gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Re-attach to main editor</span>
        </Button>
      </header>

      {/* ── Full-bleed PDF Surface ── */}
      <main className="flex-1 min-h-0 min-w-0 w-full h-full relative">
        <PdfViewer />
      </main>
    </div>
  );
}
