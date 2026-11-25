'use client';

/**
 * CompilationErrorBanner.tsx
 *
 * Floating Compilation Error Alert Banner (Block 5: PDF Viewer & Compiler Panel).
 * Location: `features/editor/subsystems/compiler/ui/CompilationErrorBanner.tsx`
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

const DEFAULT_UNAVAILABLE_MSG = 'Unable to compile right now. Please try again.';
const RAW_BACKEND_ERROR_RE = /backend\s*server|ensure\s+backend|failed\s+to\s+fetch|network\s+error|econnrefused/i;

function formatServiceUnavailableMessage(msg?: string | null): string {
  const trimmed = msg?.trim();
  if (!trimmed || RAW_BACKEND_ERROR_RE.test(trimmed)) {
    return DEFAULT_UNAVAILABLE_MSG;
  }
  return trimmed;
}

const ACTION_BTN_CLASS =
  'inline-flex items-center gap-1.5 h-7 px-2.5 text-12 font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0';

const TONE_CLASSES = {
  destructive: 'bg-destructive/10 border-b border-destructive/25 text-destructive',
  warning: 'bg-warning/10 border-b border-warning/25 text-warning',
  muted: 'bg-muted/70 border-b border-border text-foreground',
} as const;

interface BannerLayoutProps {
  role?: 'alert' | 'status';
  mode: string;
  tone: keyof typeof TONE_CLASSES;
  icon: React.ReactNode;
  message: string;
  onMessageClick?: () => void;
  messageTitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

function BannerLayout({
  role = 'alert',
  mode,
  tone,
  icon,
  message,
  onMessageClick,
  messageTitle,
  actions,
  className,
}: BannerLayoutProps) {
  const content = (
    <>
      {icon}
      <span className="text-12 font-medium truncate min-w-0 flex-1">{message}</span>
    </>
  );

  return (
    <div
      role={role}
      aria-live="polite"
      data-testid="compilation-error-banner"
      data-banner-mode={mode}
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-1.5 select-none z-20 shrink-0 transition-colors duration-150',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {onMessageClick ? (
        <button
          type="button"
          onClick={onMessageClick}
          title={messageTitle}
          className="flex items-center gap-2 min-w-0 text-left cursor-pointer hover:underline outline-none focus-visible:underline"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-2 min-w-0">{content}</div>
      )}

      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
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
      <BannerLayout
        mode="clsi-unavailable"
        tone="destructive"
        icon={<CloudOff className="size-3.5 shrink-0" strokeWidth={1.75} />}
        message={formatServiceUnavailableMessage(errorMessage)}
        onMessageClick={onOpenLogs}
        className={className}
        actions={
          (onRetry || onOpenLogs) && (
            <>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  aria-label="Retry compile"
                  className={ACTION_BTN_CLASS}
                >
                  <RefreshCw className="size-3" strokeWidth={1.75} />
                  <span>Retry</span>
                </button>
              )}
              {onOpenLogs && (
                <button
                  type="button"
                  onClick={onOpenLogs}
                  aria-label="View logs"
                  className={ACTION_BTN_CLASS}
                >
                  Logs
                </button>
              )}
            </>
          )
        }
      />
    );
  }

  if (outcome === 'code-check-blocked') {
    return (
      <BannerLayout
        mode="code-check-blocked"
        tone="warning"
        icon={<ShieldAlert className="size-3.5 shrink-0" strokeWidth={1.75} />}
        message="Auto-compile paused: syntax error detected before build"
        onMessageClick={onOpenLogs}
        className={className}
        actions={
          (errorCount > 0 || onCompileAnyway) && (
            <>
              {errorCount > 0 && (
                <button
                  type="button"
                  onClick={onJumpToFirstError}
                  aria-label="Jump to first error"
                  className={ACTION_BTN_CLASS}
                >
                  Jump to error
                </button>
              )}
              {onCompileAnyway && (
                <button
                  type="button"
                  onClick={onCompileAnyway}
                  className={ACTION_BTN_CLASS}
                >
                  Compile anyway
                </button>
              )}
            </>
          )
        }
      />
    );
  }

  if (outcome === 'rate-limited') {
    return (
      <BannerLayout
        mode="rate-limited"
        tone="warning"
        icon={<Clock className="size-3.5 shrink-0" strokeWidth={1.75} />}
        message={errorMessage || 'Compilation rate limit reached — please wait a moment before retrying'}
        onMessageClick={onOpenLogs}
        className={className}
        actions={
          (onRetry || onOpenLogs) && (
            <>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  aria-label="Retry compile"
                  className={ACTION_BTN_CLASS}
                >
                  <RefreshCw className="size-3" strokeWidth={1.75} />
                  <span>Retry</span>
                </button>
              )}
              {onOpenLogs && (
                <button
                  type="button"
                  onClick={onOpenLogs}
                  aria-label="View logs"
                  className={ACTION_BTN_CLASS}
                >
                  Logs
                </button>
              )}
            </>
          )
        }
      />
    );
  }

  if (outcome === 'offline-queued') {
    return (
      <BannerLayout
        role="status"
        mode="offline-queued"
        tone="muted"
        icon={<WifiOff className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
        message="Offline — compile request queued until connection is restored"
        className={className}
        actions={
          onRetry && (
            <button
              type="button"
              onClick={onRetry}
              aria-label="Retry compile"
              className={ACTION_BTN_CLASS}
            >
              Retry
            </button>
          )
        }
      />
    );
  }

  if ((outcome === 'timedout' || outcome === 'validation-problems') && errorCount <= 0) {
    return (
      <BannerLayout
        mode={outcome}
        tone="destructive"
        icon={<AlertCircle className="size-3.5 shrink-0" strokeWidth={1.75} />}
        message={
          outcome === 'timedout'
            ? 'Compilation timed out before completion'
            : errorMessage || 'Pre-compile validation problems blocked this build'
        }
        onMessageClick={onOpenLogs}
        className={className}
        actions={
          onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              aria-label="View logs"
              className={ACTION_BTN_CLASS}
            >
              Logs
            </button>
          )
        }
      />
    );
  }

  if (errorCount <= 0) return null;

  return (
    <BannerLayout
      mode="batch-errors"
      tone="destructive"
      icon={<AlertCircle className="size-3.5 shrink-0" strokeWidth={1.75} />}
      message={`${errorCount} compilation ${errorCount === 1 ? 'error' : 'errors'} detected in this build`}
      onMessageClick={onOpenLogs}
      messageTitle="Click to view full compilation logs"
      className={className}
      actions={
        <button
          type="button"
          onClick={onJumpToFirstError}
          aria-label="Jump to first error"
          className={cn(ACTION_BTN_CLASS, "relative after:absolute after:-inset-1 after:content-['']")}
        >
          Jump to error
        </button>
      }
    />
  );
});

export default CompilationErrorBanner;
