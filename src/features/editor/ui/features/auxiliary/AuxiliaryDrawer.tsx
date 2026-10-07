/**
 * AuxiliaryDrawer.tsx
 *
 * Canonical VS Code-Style Auxiliary Bar / Secondary Sidebar (Block 7: UI Features Layer).
 * Location: `features/editor/ui/features/auxiliary/AuxiliaryDrawer.tsx`
 *
 * Features:
 * - Slides out from the right edge alongside the PDF preview.
 * - Tabbed switching between AI Research Assistant and Review Comments.
 * - Header with close action and resizable drag handle.
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Bot, MessageSquareText, X, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useLayoutStore, type AuxiliaryTab } from '../../../store/layout.store';

const PanelLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center p-6 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" />
    <span className="text-xs">Loading panel...</span>
  </div>
);

const ReviewTab = dynamic(() => import('../../../components/sidebar/review/ReviewTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const AiTab = dynamic(() => import('../../../components/sidebar/ai/AiTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

export function AuxiliaryDrawer() {
  const {
    activeAuxiliaryTab,
    setActiveAuxiliaryTab,
    setAuxiliaryRightOpen,
  } = useLayoutStore();

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden select-none">
      {/* ── Drawer Header ─────────────────────────────────────────────────── */}
      <div className="h-9 shrink-0 flex items-center justify-between border-b border-border bg-sidebar px-3">
        <div className="flex items-center gap-1">
          {/* AI Assistant Tab */}
          <button
            type="button"
            onClick={() => setActiveAuxiliaryTab('ai')}
            className={cn(
              'flex items-center gap-1.5 h-6.5 px-2.5 rounded-xs text-xs font-medium transition-colors cursor-pointer outline-none',
              activeAuxiliaryTab === 'ai'
                ? 'bg-surface text-primary font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-hover'
            )}
          >
            <Bot className="size-3.5 shrink-0" />
            <span>AI Copilot</span>
          </button>

          {/* Comments & Review Tab */}
          <button
            type="button"
            onClick={() => setActiveAuxiliaryTab('comments')}
            className={cn(
              'flex items-center gap-1.5 h-6.5 px-2.5 rounded-xs text-xs font-medium transition-colors cursor-pointer outline-none',
              activeAuxiliaryTab === 'comments'
                ? 'bg-surface text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-hover'
            )}
          >
            <MessageSquareText className="size-3.5 shrink-0" />
            <span>Review</span>
          </button>
        </div>

        {/* Close Drawer Button */}
        <button
          type="button"
          onClick={() => setAuxiliaryRightOpen(false)}
          aria-label="Close auxiliary drawer"
          className="flex size-6 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ── Drawer Content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden bg-background">
        {activeAuxiliaryTab === 'ai' ? (
          <AiTab onClose={() => setAuxiliaryRightOpen(false)} />
        ) : (
          <ReviewTab onClose={() => setAuxiliaryRightOpen(false)} />
        )}
      </div>
    </div>
  );
}

export default AuxiliaryDrawer;
