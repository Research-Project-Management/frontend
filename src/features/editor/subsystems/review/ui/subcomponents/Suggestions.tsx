'use client';

/**
 * Suggestions.tsx
 *
 * Cohesive suggestion and track changes controls for the Review sidebar:
 * - SuggestionCard: displays suggestion author, line jump, diff preview, accept/reject buttons
 * - SuggestionBulkActions: reject all / accept all toolbar
 */

import React, { useMemo } from 'react';
import { CheckCircle2, User, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import { formatReviewDate, resolveAuthorDisplay } from '@/features/editor/domain/collaboration/author-display';

const REVIEW_CARD_CONTAINMENT_STYLE: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 140px',
};

// ── Suggestion Card ─────────────────────────────────────────────────────────

export interface SuggestionCardProps {
  suggestion: PageSuggestion;
  pageId?: string;
  onNavigate?: (line: number) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
  isHighlighted?: boolean;
  membersMap?: Map<string, MentionMember>;
}

export const SuggestionCard = React.memo(function SuggestionCard({
  suggestion,
  onNavigate,
  onAccept,
  onReject,
  isAccepting = false,
  isRejecting = false,
  isHighlighted = false,
  membersMap,
}: SuggestionCardProps) {
  const isPending = suggestion.status === 'pending';

  const typeColor =
    suggestion.type === 'insert'
      ? 'bg-primary/10 text-primary border-primary/20'
      : suggestion.type === 'delete'
        ? 'bg-destructive/10 text-destructive border-destructive/25'
        : 'bg-warning/10 text-warning border-warning/25';

  const authorDisplay = useMemo(
    () => resolveAuthorDisplay(suggestion.author, membersMap, suggestion.authorId ?? undefined),
    [suggestion, membersMap],
  );

  return (
    <div
      id={`suggestion-${suggestion.id}`}
      style={REVIEW_CARD_CONTAINMENT_STYLE}
      className={cn(
        'mb-2.5 rounded-md border border-border bg-card p-3 space-y-2.5 transition-colors duration-150 text-xs text-card-foreground',
        isHighlighted && 'ring-1 ring-primary/40 border-primary',
        !isPending && 'opacity-70',
      )}
    >
      {/* Author & Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {authorDisplay.avatar ? (
            <img
              src={authorDisplay.avatar}
              alt={authorDisplay.name}
              className="size-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <User className="size-3 text-primary shrink-0" />
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <span className="font-semibold text-foreground truncate block text-xs">
              {authorDisplay.name}
            </span>
            <span className="text-11 font-mono text-muted-foreground">
              {formatReviewDate(suggestion.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('px-2 py-0.5 rounded-sm text-11 font-medium capitalize', typeColor)}>
            {suggestion.type}
          </span>
          {suggestion.fromLine != null && (
            <button
              type="button"
              onClick={() => onNavigate?.(suggestion.fromLine!)}
              aria-label={`Jump to line ${suggestion.fromLine}`}
              className="px-2 py-0.5 rounded-sm bg-muted hover:bg-muted/80 text-11 font-mono text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
              title={`Jump to line ${suggestion.fromLine}`}
            >
              L{suggestion.fromLine}
            </button>
          )}
        </div>
      </div>

      {/* Diff Preview */}
      <div className="rounded-md bg-muted/40 p-2.5 font-mono text-xs leading-relaxed break-words space-y-1.5">
        {suggestion.originalText && (
          <div className="text-destructive bg-destructive/10 border border-destructive/25 px-2 py-1 rounded-sm line-through">
            - {suggestion.originalText}
          </div>
        )}
        {suggestion.suggestedText && (
          <div className="text-success bg-success/10 border border-success/20 px-2 py-1 rounded-sm">
            + {suggestion.suggestedText}
          </div>
        )}
      </div>

      {/* Note / Description */}
      {suggestion.description && (
        <p className="text-muted-foreground text-12 italic leading-normal">
          &ldquo;{suggestion.description}&rdquo;
        </p>
      )}

      {/* Accept / Reject Actions */}
      {isPending ? (
        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
          <button
            type="button"
            onClick={() => onReject(suggestion.id)}
            disabled={isRejecting || isAccepting}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
          >
            <X className="size-3.5 shrink-0" />
            <span>Reject</span>
          </button>
          <button
            type="button"
            onClick={() => onAccept(suggestion.id)}
            disabled={isAccepting || isRejecting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-50 cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
          >
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>Accept</span>
          </button>
        </div>
      ) : (
        <div className="pt-1 text-11 text-muted-foreground text-right italic">
          Status: <span className="font-medium capitalize">{suggestion.status}</span>
        </div>
      )}
    </div>
  );
});

// ── Suggestion Bulk Actions ─────────────────────────────────────────────────

export interface SuggestionBulkActionsProps {
  count: number;
  onRejectAll: () => void;
  onAcceptAll: () => void;
  isRejecting?: boolean;
  isAccepting?: boolean;
}

export function SuggestionBulkActions({
  count,
  onRejectAll,
  onAcceptAll,
  isRejecting = false,
  isAccepting = false,
}: SuggestionBulkActionsProps) {
  if (count <= 0) return null;

  return (
    <div className="flex items-center justify-between border-b border-border px-3.5 py-2 text-xs shrink-0 bg-background">
      <span className="text-11 font-mono font-medium text-muted-foreground">
        {count} pending suggestion{count > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRejectAll}
          disabled={isRejecting || isAccepting}
          className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 relative after:absolute after:-inset-1 after:content-['']"
        >
          Reject All
        </button>
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={isAccepting || isRejecting}
          className="px-2.5 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors cursor-pointer disabled:opacity-50 relative after:absolute after:-inset-1 after:content-['']"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
