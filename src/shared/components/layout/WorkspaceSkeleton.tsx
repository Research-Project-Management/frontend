import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Unified Workspace Loading & Transition System (Single Source of Truth).
 *
 * Enforces DESIGN.md ("The Linear Lab Protocol"):
 * 1. Zero Layout Shift (CLS = 0): Strict 44px (`h-11`) header, 36px (`h-9`) filter strip,
 *    and 32px (`h-8`) row cadence across all workspace surfaces.
 * 2. Anti-Flicker Delayed Entrance: Skeletons wait 75ms (`delay-75 fill-mode-backwards`)
 *    before appearing so sub-75ms cache/network hits never flash a 1-frame skeleton.
 * 3. Synchronized Optical Reveal: `WorkspaceViewTransition` applies a calm, zero-shift
 *    120ms opacity transition when switching views or resolving data.
 */

const DETERMINISTIC_TITLE_WIDTHS = [
  'w-[38%]',
  'w-[52%]',
  'w-[44%]',
  'w-[61%]',
  'w-[35%]',
  'w-[49%]',
  'w-[56%]',
  'w-[41%]',
  'w-[64%]',
  'w-[46%]',
] as const;

const SKELETON_CONTAINER_SYNC =
  'animate-in fade-in duration-150 delay-75 fill-mode-backwards motion-reduce:animate-none select-none';

export interface WorkspaceViewTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps resolved page/view body content to provide a consistent, zero-shift
 * optical fade-in across the entire workspace.
 */
export function WorkspaceViewTransition({
  children,
  className,
}: WorkspaceViewTransitionProps) {
  return (
    <div
      className={cn(
        'animate-in fade-in duration-150 ease-out motion-reduce:animate-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface WorkspaceRowListSkeletonProps {
  rows?: number;
  variant?: 'work-items' | 'drafts' | 'pages' | 'library' | 'your-work';
  showTableHeader?: boolean;
  className?: string;
}

/**
 * Canonical 32px (`h-8`) row skeleton used across Work Items, Drafts, Pages (List),
 * Library Table, Your Work, and App Router route fallbacks.
 */
export function WorkspaceRowListSkeleton({
  rows = 10,
  variant = 'work-items',
  showTableHeader = false,
  className,
}: WorkspaceRowListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading workspace items"
      className={cn(
        'flex-1 overflow-hidden w-full',
        variant === 'drafts' || variant === 'pages'
          ? 'divide-y divide-border/60 border-b border-border'
          : 'p-4 space-y-1.5',
        SKELETON_CONTAINER_SYNC,
        className,
      )}
    >
      {showTableHeader && (
        <div className="flex h-8 items-center gap-4 border-b border-border px-2 pb-1.5 mb-1">
          <Skeleton className="size-3.5 shrink-0 rounded-xs" />
          <Skeleton className="h-3 w-28 rounded-xs" />
          <Skeleton className="h-3 w-20 rounded-xs ml-auto hidden sm:block" />
          <Skeleton className="h-3 w-16 rounded-xs hidden sm:block" />
        </div>
      )}

      {Array.from({ length: rows }).map((_, index) => {
        const widthClass =
          DETERMINISTIC_TITLE_WIDTHS[index % DETERMINISTIC_TITLE_WIDTHS.length];

        return (
          <div
            key={index}
            className={cn(
              'flex h-8 items-center justify-between gap-4',
              variant === 'drafts' || variant === 'pages'
                ? 'px-4'
                : 'rounded-md border border-transparent px-2',
            )}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="size-3.5 shrink-0 rounded-xs" />
              {variant !== 'library' && (
                <Skeleton className="h-3.5 w-14 shrink-0 rounded-xs" />
              )}
              <Skeleton className={cn('h-3.5 rounded-xs', widthClass)} />
            </div>

            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <Skeleton className="h-4 w-16 rounded-xs" />
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3.5 w-12 rounded-xs" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface WorkspaceBoardSkeletonProps {
  columns?: number;
  className?: string;
}

/**
 * Canonical Kanban Board skeleton matching the exact 288px (`w-72`) column geometry.
 */
export function WorkspaceBoardSkeleton({
  columns = 4,
  className,
}: WorkspaceBoardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading board columns"
      className={cn(
        'flex-1 flex gap-4 p-4 overflow-hidden',
        SKELETON_CONTAINER_SYNC,
        className,
      )}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2.5">
          <div className="flex h-8 items-center justify-between rounded-md bg-muted/40 px-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-3.5 w-20 rounded-xs" />
            </div>
            <Skeleton className="h-3.5 w-6 rounded-xs" />
          </div>
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export interface WorkspaceCardGridSkeletonProps {
  count?: number;
  variant?: 'projects' | 'pages' | 'stickies';
  className?: string;
}

/**
 * Canonical Card Grid skeleton used across Projects, Pages (Grid), and Stickies.
 */
export function WorkspaceCardGridSkeleton({
  count = 8,
  variant = 'projects',
  className,
}: WorkspaceCardGridSkeletonProps) {
  if (variant === 'stickies') {
    return (
      <div
        role="status"
        aria-label="Loading stickies"
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start',
          SKELETON_CONTAINER_SYNC,
          className,
        )}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex h-[220px] flex-col justify-between rounded-md border border-border bg-card p-4"
          >
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-1/2 rounded-xs" />
              <Skeleton className="h-3 w-5/6 rounded-xs" />
              <Skeleton className="h-3 w-2/3 rounded-xs" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <Skeleton className="h-3 w-16 rounded-xs" />
              <Skeleton className="size-4 rounded-xs" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading cards"
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 min-w-0',
        SKELETON_CONTAINER_SYNC,
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-md border border-border bg-card overflow-hidden"
        >
          <div className="h-24 w-full bg-muted/40 border-b border-border/60 p-3.5 flex flex-col justify-between">
            <Skeleton className="h-3.5 w-16 rounded-xs" />
            <Skeleton className="h-2.5 w-1/2 rounded-xs" />
          </div>
          <div className="p-3.5 space-y-2.5">
            <Skeleton className="h-4 w-2/3 rounded-xs" />
            <Skeleton className="h-3 w-4/5 rounded-xs" />
            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-xs" />
              <Skeleton className="h-3 w-12 rounded-xs" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Canonical Project Overview / Mission Control skeleton.
 */
export function WorkspaceOverviewSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading project overview"
      className={cn(
        'flex-1 overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto w-full',
        SKELETON_CONTAINER_SYNC,
        className,
      )}
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Skeleton className="md:col-span-8 h-64 w-full rounded-md" />
          <Skeleton className="md:col-span-4 h-64 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full Workspace Shell Skeleton (44px Topbar + 36px Toolbar + 32px Row List).
 * Used by Next.js route-level `loading.tsx` boundaries.
 */
export function WorkspaceShellSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Topbar header skeleton (44px / h-11) */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-4 rounded-xs" />
          <Skeleton className="h-4 w-28 rounded-xs" />
          <Skeleton className="h-4 w-8 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-36 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* Secondary filter / toolbar strip (36px / h-9) */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-xs" />
          <Skeleton className="h-5 w-20 rounded-xs" />
          <Skeleton className="h-5 w-16 rounded-xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-5 w-14 rounded-xs" />
        </div>
      </div>

      {/* Main body content skeleton: 32px (h-8) Linear Lab row cadence */}
      <WorkspaceRowListSkeleton rows={10} variant="work-items" />
    </div>
  );
}
