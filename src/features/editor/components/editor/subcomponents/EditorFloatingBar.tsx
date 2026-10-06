'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, FileCheck, Sparkles } from 'lucide-react';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useActionsStore } from '@/features/editor/store';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
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
  onOpenSuggest: (opts: {
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

export const EditorFloatingBar = React.memo(function EditorFloatingBar({
  selFloating,
  selFloatingRef,
  reviewMode = false,
  onClose,
  onOpenSuggest,
  onOpenAiAssist,
}: EditorFloatingBarProps) {
  const setPendingComment = useActionsStore((s) => s.setPendingComment);

  if (!selFloating || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={selFloatingRef}
      className="fixed z-50 flex items-center gap-1 rounded-md border border-border bg-popover text-popover-foreground px-1 py-1 shadow-raised-200"
      style={{ left: selFloating.x, top: selFloating.y }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setPendingComment({
            startLine: selFloating.startLine,
            endLine: selFloating.endLine,
            selectedText: selFloating.text,
          });
          EditorEventBus.emit('flux:open-panel', 'Review');
          onClose();
        }}
        className="h-7 px-2 text-xs font-normal text-foreground hover:bg-muted gap-1.5 cursor-pointer"
        title="Add Comment"
      >
        <MessageSquarePlus className="size-3.5 shrink-0" />
        <span>Comment</span>
      </Button>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onOpenSuggest({
            originalText: selFloating.text,
            suggestedText: selFloating.text,
            fromLine: selFloating.startLine,
            toLine: selFloating.endLine,
            type: selFloating.text ? 'replace' : 'insert',
            description: '',
          });
          onClose();
        }}
        className={cn(
          "h-7 px-2 text-xs font-normal gap-1.5 cursor-pointer",
          reviewMode
            ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 font-semibold ring-1 ring-amber-500/40"
            : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
        )}
        title={reviewMode ? "Suggest Edit (Track Changes Active)" : "Suggest Edit (Track Changes)"}
      >
        <FileCheck className="size-3.5 shrink-0" />
        <span>Suggest{reviewMode ? ' (Active)' : ''}</span>
      </Button>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (onOpenAiAssist) {
            onOpenAiAssist({
              selectedText: selFloating.text,
              startLine: selFloating.startLine,
              endLine: selFloating.endLine,
              position: { x: selFloating.x, y: selFloating.y },
            });
          } else {
            EditorEventBus.emit('flux:open-ai-panel', { selectedText: selFloating.text });
          }
          onClose();
        }}
        className="h-7 px-2 text-xs font-normal text-foreground hover:bg-muted gap-1.5 cursor-pointer"
        title="AI Assist"
      >
        <Sparkles className="size-3.5 shrink-0 text-ai" />
        <span>AI Assist</span>
      </Button>
    </div>,
    document.body,
  );
});
