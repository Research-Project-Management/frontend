'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, MessageSquare, CornerDownRight, Loader2 } from 'lucide-react';
import type { PageSuggestion } from '@/features/editor/types';
import { cn } from '@/shared/lib/utils';

export interface InlineSuggestionWidgetData {
  suggestion: PageSuggestion;
  x: number;
  y: number;
}

export interface InlineSuggestionWidgetProps {
  data: InlineSuggestionWidgetData | null;
  isAccepting?: boolean;
  isRejecting?: boolean;
  onAccept: (suggestion: PageSuggestion) => void;
  onReject: (suggestion: PageSuggestion) => void;
  onClose: () => void;
  onOpenReviewTab?: (suggestionId: string) => void;
}

export const InlineSuggestionWidget = React.memo(function InlineSuggestionWidget({
  data,
  isAccepting = false,
  isRejecting = false,
  onAccept,
  onReject,
  onClose,
  onOpenReviewTab,
}: InlineSuggestionWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!data) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onAccept(data.suggestion);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Delay binding mouse down to prevent immediate trigger from opening click
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [data, onClose]);

  if (!data || typeof document === 'undefined') return null;

  const { suggestion, x, y } = data;
  const isPending = isAccepting || isRejecting;

  // Viewport bounds safe positioning
  const left = Math.min(Math.max(16, x), window.innerWidth - 360);
  const top = Math.min(Math.max(16, y), window.innerHeight - 250);

  const typeConfig = {
    insert: {
      label: 'Added',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    delete: {
      label: 'Deleted',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
    replace: {
      label: 'Replaced',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
  }[suggestion.type] || {
    label: suggestion.type,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  };

  const authorInitial = (suggestion.author?.name || 'User').charAt(0).toUpperCase();

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Track change proposal"
      className="fixed z-[9998] w-84 rounded-xl border border-border bg-card/95 backdrop-blur-md p-3.5 shadow-raised-200 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left, top }}
    >
      {/* ── Header: Author & Action Type ── */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
            {authorInitial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {suggestion.author?.name || 'Author'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Lines {suggestion.fromLine} - {suggestion.toLine}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider',
              typeConfig.badgeClass,
            )}
          >
            {typeConfig.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Dismiss widget (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body: Diff Preview ── */}
      <div className="py-2.5 space-y-2 text-xs">
        {suggestion.originalText && (
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Original:</span>
            <div className="max-h-16 overflow-y-auto px-2 py-1 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono text-[11px] line-through break-all">
              {suggestion.originalText}
            </div>
          </div>
        )}

        {suggestion.suggestedText && (
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Proposed:</span>
            <div className="max-h-16 overflow-y-auto px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-medium break-all">
              {suggestion.suggestedText}
            </div>
          </div>
        )}

        {suggestion.description && (
          <div className="flex items-start gap-1.5 p-1.5 rounded bg-muted/60 text-[11px] text-muted-foreground italic">
            <CornerDownRight className="size-3 mt-0.5 shrink-0 text-primary" />
            <span className="line-clamp-2">{suggestion.description}</span>
          </div>
        )}
      </div>

      {/* ── Footer: Action Buttons (1-Click Accept / Reject) ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        {onOpenReviewTab && (
          <button
            type="button"
            onClick={() => {
              onOpenReviewTab(suggestion.id);
              onClose();
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <MessageSquare className="size-3" />
            <span>View thread</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onReject(suggestion)}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium border border-border bg-background hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 text-muted-foreground transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isRejecting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" />
            )}
            Reject
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => onAccept(suggestion)}
            className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isAccepting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Accept
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});
