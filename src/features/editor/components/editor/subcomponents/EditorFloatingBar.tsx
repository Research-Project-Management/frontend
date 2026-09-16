'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, FileCheck } from 'lucide-react';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useActionsStore } from '@/features/editor/store';

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
  onClose: () => void;
  onOpenSuggest: (opts: {
    originalText: string;
    suggestedText: string;
    fromLine: number;
    toLine: number;
    type: 'replace' | 'insert' | 'delete';
    description: string;
  }) => void;
}

export function EditorFloatingBar({
  selFloating,
  selFloatingRef,
  onClose,
  onOpenSuggest,
}: EditorFloatingBarProps) {
  const { setPendingComment } = useActionsStore();

  if (!selFloating || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={selFloatingRef}
      className="fixed z-[9998] flex items-center gap-px rounded-lg border border-border bg-popover px-1 py-1 shadow-raised-200"
      style={{ left: selFloating.x, top: selFloating.y }}
    >
      <button
        onClick={() => {
          setPendingComment({
            startLine: selFloating.startLine,
            endLine: selFloating.endLine,
            selectedText: selFloating.text,
          });
          EditorEventBus.emit('flux:open-panel', 'Review');
          onClose();
        }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
        title="Add Comment"
      >
        <MessageSquarePlus className="size-3.5 shrink-0" />
        <span>Comment</span>
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
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
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
        title="Suggest Edit (Track Changes)"
      >
        <FileCheck className="size-3.5 shrink-0" />
        <span>Suggest</span>
      </button>
    </div>,
    document.body,
  );
}
