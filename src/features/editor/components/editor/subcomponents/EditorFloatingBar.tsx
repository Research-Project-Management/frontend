'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareText, Sparkles } from 'lucide-react';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useActionsStore, useSettingsStore } from '@/features/editor/store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export interface SelFloating {
  x: number;
  y: number;
  startLine: number;
  endLine: number;
  text: string;
}

export interface EditorFloatingBarProps {
  selFloating: SelFloating | null;
  selFloatingRef: React.RefObject<HTMLDivElement | null>;
  reviewMode?: boolean;
  onClose: () => void;
  onOpenSuggest?: (opts: {
    originalText: string;
    suggestedText: string;
    fromLine: number;
    toLine: number;
    type: 'replace' | 'insert' | 'delete';
    description: string;
  }) => void;
  onOpenAiAssist?: (opts: {
    selectedText: string;
    startLine: number;
    endLine: number;
    position: { x: number; y: number };
  }) => void;
}

/**
 * Vertical Floating Selection Action Pill (Overleaf Parity)
 * Appears beside the text selection in the gutter when text is highlighted/dragged.
 * Features:
 * 1. Comment Action: Adds review comment for selected lines.
 * 2. AI Assist Action: Prompts AI to explain, rewrite, or polish the selected text.
 */
export const EditorFloatingBar = React.memo(function EditorFloatingBar({
  selFloating,
  selFloatingRef,
  onClose,
  onOpenAiAssist,
}: EditorFloatingBarProps) {
  const setPendingComment = useActionsStore((s) => s.setPendingComment);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selFloating || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={selFloatingRef}
      role="toolbar"
      aria-label="Selection actions"
      className={cn(
        'fixed z-50 flex flex-col items-center justify-between',
        'w-7 h-14 p-0.5 rounded-md',
        'bg-popover border border-border shadow-raised-200 text-popover-foreground',
        'transition-all duration-150 select-none animate-in fade-in zoom-in-95',
      )}
      style={{
        left: `${selFloating.x}px`,
        top: `${selFloating.y}px`,
      }}
    >
      {/* 1. Comment Action */}
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Add comment"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPendingComment({
                startLine: selFloating.startLine,
                endLine: selFloating.endLine,
                selectedText: selFloating.text,
              });
              useSettingsStore.getState().setIsReviewOpen(true);
              EditorEventBus.emit('flux:open-panel', 'Review');
              onClose();
            }}
            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <MessageSquareText className="size-4 shrink-0" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="text-11 px-2 py-0.5 font-sans bg-popover text-popover-foreground border border-border shadow-md"
        >
          Add comment
        </TooltipContent>
      </Tooltip>

      {/* 2. AI Assist Action */}
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="AI Assist"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onOpenAiAssist) {
                onOpenAiAssist({
                  selectedText: selFloating.text,
                  startLine: selFloating.startLine,
                  endLine: selFloating.endLine,
                  position: { x: selFloating.x + 36, y: selFloating.y },
                });
              } else {
                EditorEventBus.emit('flux:open-ai-panel', { selectedText: selFloating.text });
              }
              onClose();
            }}
            className="size-6 flex items-center justify-center rounded text-ai hover:text-ai/90 hover:bg-ai/10 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <Sparkles className="size-4 text-ai fill-ai/20 shrink-0" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="text-11 px-2 py-0.5 font-sans bg-popover text-popover-foreground border border-border shadow-md"
        >
          AI Assist
        </TooltipContent>
      </Tooltip>
    </div>,
    document.body,
  );
});

export default EditorFloatingBar;
