import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Instant Shell Loading State for Overleaf-Grade LaTeX Workbench.
 * Prevents FLC (Flash of Loading Content) and CLS during editor route transitions.
 */
export default function EditorSkeleton() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Top action header */}
      <div className="flex h-11 items-center justify-between border-b border-border px-3 bg-muted">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-36 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      </div>

      {/* Editor workbench body */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Activity bar rail (left: 48px) */}
        <div className="flex w-12 flex-col items-center gap-3 border-r border-border bg-muted py-3">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>

        {/* Primary sidebar: Files tree placeholder (220px) */}
        <div className="hidden sm:flex w-56 flex-col border-r border-border bg-sidebar p-3 space-y-2.5">
          <Skeleton className="h-4 w-20 rounded-sm mb-2" />
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-4/5 rounded-md" />
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </div>

        {/* Editor Code Area */}
        <div className="flex flex-1 flex-col border-r border-border bg-canvas p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-3/5 rounded-sm" />
            <Skeleton className="h-4 w-4/5 rounded-sm" />
            <Skeleton className="h-4 w-2/5 rounded-sm" />
            <Skeleton className="h-4 w-1/2 rounded-sm" />
            <Skeleton className="h-4 w-3/4 rounded-sm" />
          </div>
        </div>

        {/* PDF Previewer Pane */}
        <div className="hidden lg:flex w-2/5 flex-col bg-muted/50 p-6 items-center justify-center">
          <div className="h-4/5 w-4/5 rounded-md border border-border bg-card p-6 shadow-none space-y-4">
            <Skeleton className="h-6 w-1/2 rounded-md mx-auto" />
            <Skeleton className="h-4 w-3/4 rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
            <Skeleton className="h-4 w-2/3 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
