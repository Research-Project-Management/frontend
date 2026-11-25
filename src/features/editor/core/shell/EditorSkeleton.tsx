import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';

const SIDEBAR_SKELETON_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-20', 'w-28'];
const EDITOR_LINE_WIDTHS = ['65%', '45%', '80%', '30%', '55%', '85%', '40%', '70%', '25%', '75%', '50%', '35%'];

/**
 * Instant Shell Loading State for Overleaf-Grade LaTeX Workbench.
 * Matches Topbar, ActivityBar, PrimarySidebar, EditorArea, and PreviewPane tokens.
 */
export default function EditorSkeleton() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Topbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background px-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="h-4 w-36 rounded-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      </div>

      {/* Workbench Body */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* ActivityBar Rail */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-border bg-background py-3">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="size-6 rounded-md" />
        </div>

        {/* PrimarySidebar */}
        <div className="hidden sm:flex w-64 shrink-0 flex-col border-r border-border bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <Skeleton className="h-3.5 w-16 rounded-sm" />
            <Skeleton className="size-4 rounded-sm" />
          </div>
          {SIDEBAR_SKELETON_WIDTHS.map((widthClass, idx) => (
            <div key={idx} className="flex h-7 items-center gap-2 px-1">
              <Skeleton className="size-3.5 rounded-sm shrink-0" />
              <Skeleton className={`h-3.5 rounded-sm ${widthClass}`} />
            </div>
          ))}
        </div>

        {/* EditorArea */}
        <div className="flex flex-1 min-w-0 flex-col border-r border-border bg-canvas">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-secondary/40 px-3">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
          <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-background px-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <div className="flex-1 bg-[var(--editor-bg,hsl(var(--background)))] p-5 space-y-2.5 overflow-hidden">
            {EDITOR_LINE_WIDTHS.map((width, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Skeleton className="h-3 w-5 rounded-sm shrink-0 opacity-40" />
                <Skeleton className="h-3.5 rounded-sm" style={{ width }} />
              </div>
            ))}
          </div>
        </div>

        {/* PreviewPane */}
        <div className="hidden lg:flex w-2/5 shrink-0 flex-col bg-muted/40">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-background px-3">
            <Skeleton className="h-6 w-24 rounded-md" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="size-6 rounded-md" />
            </div>
          </div>
          <div className="flex-1 p-6 flex items-center justify-center overflow-hidden">
            <div className="h-4/5 w-4/5 rounded-md border border-border bg-card p-6 shadow-none space-y-4">
              <Skeleton className="h-6 w-1/2 rounded-md mx-auto" />
              <Skeleton className="h-3.5 w-3/4 rounded-sm" />
              <Skeleton className="h-3.5 w-full rounded-sm" />
              <Skeleton className="h-3.5 w-full rounded-sm" />
              <Skeleton className="h-3.5 w-2/3 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
