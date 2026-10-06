'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, MessageSquare, CornerDownRight, Loader2 } from 'lucide-react';
import type { PageSuggestion } from '@/features/editor/types';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
      badgeClass: 'bg-success/15 text-success border-success/20',
    },
    delete: {
      label: 'Deleted',
      badgeClass: 'bg-destructive/15 text-destructive border-destructive/20',
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
      className="fixed z-50 w-84 rounded-lg border border-border bg-popover text-popover-foreground p-3.5 shadow-raised-300 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left, top }}
    >
      {/* ── Header: Author & Action Type ── */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
            {authorInitial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {suggestion.author?.name || 'Author'}
            </p>
            <p className="text-10 text-muted-foreground">
              Lines {suggestion.fromLine} - {suggestion.toLine}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              'px-1.5 py-0.5 rounded-sm text-10 font-medium tracking-normal border',
              typeConfig.badgeClass,
            )}
          >
            {typeConfig.label}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Dismiss widget"
            className="size-6 p-0 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            title="Dismiss widget (Esc)"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Body: Diff Preview ── */}
      <div className="py-2.5 space-y-2 text-xs">
        {suggestion.originalText && (
          <div className="space-y-0.5">
            <span className="text-10 font-medium text-muted-foreground">Original:</span>
            <div className="max-h-16 overflow-y-auto px-2 py-1 rounded-md bg-destructive/10 text-destructive font-mono text-xs line-through break-all">
              {suggestion.originalText}
            </div>
          </div>
        )}

        {suggestion.suggestedText && (
          <div className="space-y-0.5">
            <span className="text-10 font-medium text-muted-foreground">Proposed:</span>
            <div className="max-h-16 overflow-y-auto px-2 py-1 rounded-md bg-success/10 text-success font-mono text-xs font-medium break-all">
              {suggestion.suggestedText}
            </div>
          </div>
        )}

        {suggestion.description && (
          <div className="flex items-start gap-1.5 p-1.5 rounded-sm bg-muted/60 text-xs text-muted-foreground italic">
            <CornerDownRight className="size-3 mt-0.5 shrink-0 text-primary" />
            <span className="line-clamp-2">{suggestion.description}</span>
          </div>
        )}
      </div>

      {/* ── Footer: Action Buttons (1-Click Accept / Reject) ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        {onOpenReviewTab && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onOpenReviewTab(suggestion.id);
              onClose();
            }}
            className="h-6 px-1.5 gap-1 text-xs text-muted-foreground hover:text-primary cursor-pointer"
          >
            <MessageSquare className="size-3" />
            <span>View thread</span>
          </Button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onReject(suggestion)}
            className="h-6 px-2 text-xs font-medium gap-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 cursor-pointer"
          >
            {isRejecting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" />
            )}
            Reject
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => onAccept(suggestion)}
            className="h-6 px-2.5 text-xs font-medium gap-1 bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
          >
            {isAccepting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Accept
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
});
