'use client';

/**
 * CompilationErrorBanner.tsx
 *
 * Floating Compilation Error Alert Banner (Block 5: PDF Viewer & Compiler Panel).
 * Location: `features/editor/subsystems/compiler/ui/CompilationErrorBanner.tsx`
 *
 * Overleaf 1:1 Parity:
 * - Rendered at top of PDF preview pane when compilation fails with errors.
 * - Icon: AlertCircle (destructive red).
 * - Text: "[X] compilation error(s) detected in this build".
 * - Action: "Jump to first error" button to navigate LaTeX editor directly to the error line.
 * - Clickable message to view full compilation logs.
 */

import React from 'react';
import { AlertCircle, Clock, CloudOff, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CompileOutcome } from '@/features/editor/domain/types/compiler.types';

export interface CompilationErrorBannerProps {
  errorCount: number;
  onJumpToFirstError: () => void;
  onOpenLogs?: () => void;
  outcome?: CompileOutcome | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCompileAnyway?: () => void;
  className?: string;
}

export const CompilationErrorBanner = React.memo(function CompilationErrorBanner({
  errorCount,
  onJumpToFirstError,
  onOpenLogs,
  outcome,
  errorMessage,
  onRetry,
  onCompileAnyway,
  className,
}: CompilationErrorBannerProps) {
  if (outcome === 'clsi-unavailable') {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-testid="compilation-error-banner"
        data-banner-mode="clsi-unavailable"
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-destructive/10 border-b border-destructive/25 text-destructive select-none z-20 shrink-0 transition-colors duration-150',
          className
        )}
      >
        {onOpenLogs ? (
          <button
            type="button"
            onClick={onOpenLogs}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:underline outline-none focus-visible:underline"
          >
            <CloudOff className="size-4 shrink-0 text-destructive stroke-[2.2]" />
            <span className="text-xs font-mono font-medium text-destructive truncate">
              {errorMessage || 'Compiler service unavailable — could not reach LaTeX build engine'}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <CloudOff className="size-4 shrink-0 text-destructive stroke-[2.2]" />
            <span className="text-xs font-mono font-medium text-destructive truncate">
              {errorMessage || 'Compiler service unavailable — could not reach LaTeX build engine'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 min-h-[28px] px-3 py-1 bg-destructive/15 hover:bg-destructive/25 text-destructive text-xs font-mono font-medium rounded-md transition-colors cursor-pointer select-none"
            >
              <RefreshCw className="size-3" />
              <span>Retry compile</span>
            </button>
          )}
          {onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="min-h-[28px] px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-mono rounded-md transition-colors cursor-pointer select-none"
            >
              View logs
            </button>
          )}
        </div>
      </div>
    );
  }

  if (outcome === 'code-check-blocked') {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-testid="compilation-error-banner"
        data-banner-mode="code-check-blocked"
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-warning/10 border-b border-warning/25 text-warning select-none z-20 shrink-0 transition-colors duration-150',
          className
        )}
      >
        {onOpenLogs ? (
          <button
            type="button"
            onClick={onOpenLogs}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:underline outline-none focus-visible:underline text-warning"
          >
            <ShieldAlert className="size-4 shrink-0 stroke-[2.2]" />
            <span className="text-xs font-mono font-medium truncate">
              Auto-compile paused: syntax error detected before build
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 text-warning">
            <ShieldAlert className="size-4 shrink-0 stroke-[2.2]" />
            <span className="text-xs font-mono font-medium truncate">
              Auto-compile paused: syntax error detected before build
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {errorCount > 0 && (
            <button
              type="button"
              onClick={onJumpToFirstError}
              className="min-h-[28px] px-2.5 py-1 bg-warning/15 hover:bg-warning/25 text-warning text-xs font-mono font-medium rounded-md transition-colors cursor-pointer select-none"
            >
              Jump to error
            </button>
          )}
          {onCompileAnyway && (
            <button
              type="button"
              onClick={onCompileAnyway}
              className="min-h-[28px] px-3 py-1 bg-warning/20 hover:bg-warning/30 text-warning text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer select-none"
            >
              Compile anyway
            </button>
          )}
        </div>
      </div>
    );
  }

  if (outcome === 'rate-limited') {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-testid="compilation-error-banner"
        data-banner-mode="rate-limited"
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-warning/10 border-b border-warning/25 text-warning select-none z-20 shrink-0 transition-colors duration-150',
          className
        )}
      >
        {onOpenLogs ? (
          <button
            type="button"
            onClick={onOpenLogs}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:underline outline-none focus-visible:underline text-warning"
          >
            <Clock className="size-4 shrink-0 stroke-[2.2]" />
            <span className="text-xs font-mono font-medium truncate">
              {errorMessage || 'Compilation rate limit reached — please wait a moment before retrying'}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 text-warning">
            <Clock className="size-4 shrink-0 stroke-[2.2]" />
            <span className="text-xs font-mono font-medium truncate">
              {errorMessage || 'Compilation rate limit reached — please wait a moment before retrying'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 min-h-[28px] px-3 py-1 bg-warning/15 hover:bg-warning/25 text-warning text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer select-none"
            >
              <RefreshCw className="size-3" />
              <span>Retry compile</span>
            </button>
          )}
          {onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="min-h-[28px] px-2.5 py-1 bg-warning/10 hover:bg-warning/20 text-warning text-xs font-mono rounded-md transition-colors cursor-pointer select-none"
            >
              View logs
            </button>
          )}
        </div>
      </div>
    );
  }

  if (outcome === 'offline-queued') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="compilation-error-banner"
        data-banner-mode="offline-queued"
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-muted/70 border-b border-border text-foreground select-none z-20 shrink-0 transition-colors duration-150',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <WifiOff className="size-4 shrink-0 text-muted-foreground stroke-[2]" />
          <span className="text-xs font-mono font-medium truncate">
            Offline — compile request queued until connection is restored
          </span>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[28px] px-2.5 py-1 bg-background/80 hover:bg-background border border-border text-xs font-mono rounded-md transition-colors cursor-pointer select-none shrink-0"
          >
            Retry now
          </button>
        )}
      </div>
    );
  }

  if ((outcome === 'timedout' || outcome === 'validation-problems') && errorCount <= 0) {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-testid="compilation-error-banner"
        data-banner-mode={outcome}
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-destructive/10 border-b border-destructive/25 text-destructive select-none z-20 shrink-0 transition-colors duration-150',
          className
        )}
      >
        {onOpenLogs ? (
          <button
            type="button"
            onClick={onOpenLogs}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:underline outline-none focus-visible:underline text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 text-destructive stroke-[2.2]" />
            <span className="text-xs font-mono font-medium text-destructive truncate">
              {outcome === 'timedout'
                ? 'Compilation timed out before completion'
                : errorMessage || 'Pre-compile validation problems blocked this build'}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 text-destructive">
            <AlertCircle className="size-4 shrink-0 text-destructive stroke-[2.2]" />
            <span className="text-xs font-mono font-medium text-destructive truncate">
              {outcome === 'timedout'
                ? 'Compilation timed out before completion'
                : errorMessage || 'Pre-compile validation problems blocked this build'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="min-h-[28px] px-3 py-1 bg-destructive/15 hover:bg-destructive/25 text-destructive text-xs font-mono font-medium rounded-md transition-colors cursor-pointer select-none"
            >
              View logs
            </button>
          )}
        </div>
      </div>
    );
  }

  if (errorCount <= 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="compilation-error-banner"
      data-banner-mode="batch-errors"
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 bg-destructive/10 border-b border-destructive/25 text-destructive select-none z-20 shrink-0 transition-colors duration-150',
        className
      )}
    >
      {onOpenLogs ? (
        <button
          type="button"
          onClick={onOpenLogs}
          title="Click to view full compilation logs"
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:underline outline-none focus-visible:underline text-destructive"
        >
          <AlertCircle className="size-4 shrink-0 text-destructive stroke-[2.2]" />
          <span className="text-xs font-mono font-medium text-destructive truncate">
            {errorCount} compilation {errorCount === 1 ? 'error' : 'errors'} detected in this build
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2.5 min-w-0 text-destructive">
          <AlertCircle className="size-4 shrink-0 text-destructive stroke-[2.2]" />
          <span className="text-xs font-mono font-medium text-destructive truncate">
            {errorCount} compilation {errorCount === 1 ? 'error' : 'errors'} detected in this build
          </span>
        </div>
      )}

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
