'use client';

/**
 * ReviewNav.tsx
 *
 * Cohesive navigation and panel chrome for the Review sidebar:
 * - Review panel header with resolved comments toggle
 * - Bottom navigation bar (Current file vs. Overview scope)
 * - Empty state display
 */

import React from 'react';
import { FileText, List, MessageSquare } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { SidebarPanelHeader } from '@/features/editor/core';
import { OverleafResolvedCommentsIcon } from './ReviewBadges';

// ── Review Header ───────────────────────────────────────────────────────────

export interface ReviewHeaderProps {
  showResolved: boolean;
  onToggleResolved: () => void;
  activeResolvedCount: number;
  onClose?: () => void;
}

export function ReviewHeader({
  showResolved,
  onToggleResolved,
  activeResolvedCount,
  onClose,
}: ReviewHeaderProps) {
  const handleToggle = () => {
    if (activeResolvedCount === 0) return;
    onToggleResolved();
  };

  const tooltipLabel =
    activeResolvedCount === 0
      ? 'No resolved comments'
      : showResolved
        ? 'Hide resolved comments'
        : `Resolved comments: ${activeResolvedCount}`;

  return (
    <SidebarPanelHeader
      title="Review"
      closeAriaLabel="Close review panel"
    >
      {/* Resolved comments toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative after:absolute after:-inset-1.5 after:content-[\'\']',
              showResolved
                ? 'bg-muted text-foreground'
                : 'text-foreground hover:bg-muted',
            )}
            aria-label={tooltipLabel}
          >
            <OverleafResolvedCommentsIcon className="size-4 shrink-0 text-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </SidebarPanelHeader>
  );
}

// ── Review Bottom Nav ───────────────────────────────────────────────────────

export type ReviewScope = 'current' | 'overview' | 'chat';

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

      {/* Project Chat Tab (Overleaf Parity) */}
      <button
        type="button"
        onClick={() => onScopeChange('chat')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          scope === 'chat'
            ? 'text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {scope === 'chat' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
        )}
        <MessageSquare className="size-3.5 shrink-0" />
        <span className="leading-tight">Chat</span>
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
