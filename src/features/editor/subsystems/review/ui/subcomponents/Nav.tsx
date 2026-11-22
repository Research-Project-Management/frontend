'use client';

/**
 * Nav.tsx
 *
 * Cohesive navigation and panel chrome for the Review sidebar:
 * - Review panel header with resolved comments toggle
 * - Bottom navigation bar (Current file vs. Overview scope)
 * - Empty state display
 */

import React from 'react';
import { FileText, List, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import { formatReviewDate } from '@/features/editor/domain/collaboration/author-display';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { SidebarPanelHeader } from '@/features/editor/core';
import { MentionRenderer, ResolvedCommentsIcon } from './Badges';

// ── Review Header ───────────────────────────────────────────────────────────

export interface ReviewHeaderProps {
  showResolved: boolean;
  onToggleResolved: () => void;
  activeResolvedCount: number;
  resolvedComments?: PageComment[];
  currentFileName?: string;
  onReopenComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onClose?: () => void;
}

export function ReviewHeader({
  activeResolvedCount,
  resolvedComments = [],
  currentFileName = 'main.tex',
  onReopenComment,
  onDeleteComment,
  onClose,
}: ReviewHeaderProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const resolvedCount = resolvedComments.length || activeResolvedCount;

  const tooltipLabel =
    resolvedCount === 0
      ? 'No resolved comments'
      : `Resolved comments: ${resolvedCount}`;

  return (
    <SidebarPanelHeader
      title="Review"
      closeAriaLabel="Close review panel"
      onClose={onClose}
    >
      {/* Overleaf-style Resolved comments popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex size-7 items-center justify-center rounded-md transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-[\'\']',
                  popoverOpen
                    ? 'bg-muted text-foreground'
                    : 'text-foreground hover:bg-muted',
                )}
                aria-label={tooltipLabel}
              >
                <ResolvedCommentsIcon className="size-4 shrink-0 text-foreground" />
              </button>
            </TooltipTrigger>
          </PopoverTrigger>
          {!popoverOpen && (
            <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
          )}
        </Tooltip>

        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={6}
          className={cn(
            'p-0 overflow-hidden max-w-[calc(100vw-2rem)]',
            resolvedComments.length === 0 ? 'w-auto px-3 py-2' : 'w-80',
          )}
        >
          {resolvedComments.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No resolved comments
            </span>
          ) : (
            <div className="flex flex-col max-h-96">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <span className="text-xs font-semibold text-foreground">
                  Resolved comments
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-11 font-mono font-medium text-muted-foreground">
                  {resolvedComments.length}
                </span>
              </div>
              <div className="overflow-y-auto p-2 space-y-2">
                {resolvedComments.map((c) => {
                  const authorName = c.author?.name || 'Collaborator';
                  const initial = authorName.charAt(0).toUpperCase();
                  return (
                    <div
                      key={c.id}
                      className="rounded-md border border-border bg-card p-2.5 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-11 text-muted-foreground truncate">
                          From <span className="font-medium text-foreground">{currentFileName}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onReopenComment && (
                            <button
                              type="button"
                              onClick={() => onReopenComment(c.id)}
                              title="Reopen comment"
                              aria-label="Reopen comment"
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          )}
                          {onDeleteComment && (
                            <button
                              type="button"
                              onClick={() => onDeleteComment(c.id)}
                              title="Delete comment"
                              aria-label="Delete comment"
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-10 font-semibold text-primary shrink-0">
                          {initial}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <div className="font-medium text-foreground truncate text-12">
                            {authorName}
                          </div>
                          <div className="text-10 font-mono text-muted-foreground">
                            {formatReviewDate(c.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="text-12 text-foreground whitespace-pre-wrap break-words">
                        <MentionRenderer content={c.content} />
                      </div>

                      <div className="border-l-2 border-warning pl-2 text-11 italic text-muted-foreground">
                        Marked as resolved
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </SidebarPanelHeader>
  );
}

// ── Review Bottom Nav ───────────────────────────────────────────────────────

export type ReviewScope = 'current' | 'overview';

export interface ReviewBottomNavProps {
  scope: ReviewScope;
  onScopeChange: (scope: ReviewScope) => void;
}

export function ReviewBottomNav({ scope, onScopeChange }: ReviewBottomNavProps) {
  return (
    <nav aria-label="Review scope" className="flex h-11 shrink-0 border-t border-border bg-background select-none">
      {/* Current File Tab */}
      <button
        type="button"
        onClick={() => onScopeChange('current')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          scope === 'current'
            ? 'text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {scope === 'current' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
        )}
        <FileText className="size-3.5 shrink-0" />
        <span className="leading-tight">Current file</span>
      </button>

      {/* Overview Tab */}
      <button
        type="button"
        onClick={() => onScopeChange('overview')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          scope === 'overview'
            ? 'text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {scope === 'overview' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
        )}
        <List className="size-3.5 shrink-0" />
        <span className="leading-tight">Overview</span>
      </button>
    </nav>
  );
}

// ── Empty Review State ─────────────────────────────────────────────────────

export interface EmptyReviewStateProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyReviewState({
  title = 'No comments or suggestions',
  subtitle = 'No one has commented or left any suggestions yet.',
  action,
}: EmptyReviewStateProps) {
  return (
    <PlaneEmptyState
      variant="review"
      isCompact
      title={title}
      description={subtitle}
      action={action}
    />
  );
}
