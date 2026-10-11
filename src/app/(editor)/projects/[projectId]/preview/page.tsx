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
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

const PdfViewer = dynamic(
  () => import('@/features/editor/ui/features/preview/PdfViewer').then((mod) => mod.PdfViewer),
  { ssr: false }
);

export default function DetachedPdfPreviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel('flux-synctex-bus');

    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'preview:attached') {
        window.close();
      } else if (type === 'synctex:forward' && payload?.line) {
        editorCommandBus.dispatch({
          type: 'synctex:forward',
          line: payload.line,
          column: payload.column,
        });
      }
    };

    return () => {
      channel.close();
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
          <span>Gắn lại giao diện chính</span>
        </Button>
      </header>

      {/* ── Full-bleed PDF Surface ── */}
      <main className="flex-1 min-h-0 min-w-0 w-full h-full relative">
        <PdfViewer />
      </main>
    </div>
  );
}
