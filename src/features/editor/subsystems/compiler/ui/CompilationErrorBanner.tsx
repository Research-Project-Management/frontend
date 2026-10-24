'use client';

/**
 * CompilationErrorBanner.tsx
 *
 * Floating Compilation Error Alert Banner (Block 5: PDF Viewer & Compiler Panel).
 * Location: `features/editor/ui/features/preview/CompilationErrorBanner.tsx`
 *
 * Overleaf 1:1 Parity:
 * - Rendered at top of PDF preview pane when compilation fails with errors.
 * - Icon: AlertCircle (destructive red).
 * - Text: "[X] compilation error(s) detected in this build".
 * - Action: "Jump to first error" button to navigate LaTeX editor directly to the error line.
 * - Clickable message to view full compilation logs.
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface CompilationErrorBannerProps {
  errorCount: number;
  onJumpToFirstError: () => void;
  onOpenLogs?: () => void;
  className?: string;
}

export const CompilationErrorBanner = React.memo(function CompilationErrorBanner({
  errorCount,
  onJumpToFirstError,
  onOpenLogs,
  className,
}: CompilationErrorBannerProps) {
  if (errorCount <= 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="compilation-error-banner"
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-destructive/10 border-b border-destructive/25 text-destructive select-none z-20 shrink-0 transition-colors duration-150',
        className
      )}
    >
      <div
        onClick={onOpenLogs}
        className={cn(
          'flex items-center gap-2.5 min-w-0',
          onOpenLogs && 'cursor-pointer hover:underline'
        )}
        title={onOpenLogs ? 'Click to view full compilation logs' : undefined}
      >
        <AlertCircle className="size-4 shrink-0 text-destructive stroke-[2.2]" />
        <span className="text-xs font-mono font-medium text-destructive truncate">
          {errorCount} compilation {errorCount === 1 ? 'error' : 'errors'} detected in this build
        </span>
      </div>

      <button
        type="button"
        onClick={onJumpToFirstError}
        aria-label="Jump to first error"
        className="min-h-[28px] px-3 py-1 bg-destructive/15 hover:bg-destructive/25 active:bg-destructive/30 text-destructive text-xs font-mono font-medium rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-destructive shrink-0 relative after:absolute after:-inset-1 after:content-['']"
      >
        Jump to first error
      </button>
    </div>
  );
});

export default CompilationErrorBanner;
