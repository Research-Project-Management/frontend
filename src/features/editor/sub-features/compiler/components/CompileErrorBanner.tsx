'use client';

/**
 * CompileErrorBanner.tsx
 *
 * Visual banner displayed above the PDF viewer or editor when LaTeX compilation fails.
 * Provides error count and one-click action to view logs or jump to the first error.
 */

import React from 'react';
import { AlertCircle, Terminal, ArrowRight } from 'lucide-react';
import { useCompileStore } from '../../../store/compiler.store';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';

export interface CompileErrorBannerProps {
  onOpenLogs?: () => void;
}

export function CompileErrorBanner({ onOpenLogs }: CompileErrorBannerProps) {
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const compileErrors = useCompileStore((s) => s.compileErrors);

  if (compileStatus !== 'error' || compileErrors.length === 0) {
    return null;
  }

  const firstError = compileErrors[0];
  const errorCount = compileErrors.filter((e) => e.severity === 'error').length;
  const warningCount = compileErrors.filter((e) => e.severity === 'warning').length;

  const handleJumpToError = () => {
    if (firstError?.line) {
      editorCommandBus.dispatch({
        type: 'editor:jump-to-line',
        line: firstError.line,
        highlight: 'error',
      });
    }
  };

  return (
    <div
      role="alert"
      className="flex items-center justify-between px-3 py-1.5 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs animate-in fade-in duration-200 shrink-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="size-4 shrink-0 text-destructive" />
        <span className="font-semibold">
          Compilation failed ({errorCount} {errorCount === 1 ? 'error' : 'errors'}
          {warningCount > 0 ? `, ${warningCount} warnings` : ''}):
        </span>
        <span className="truncate opacity-90">{firstError?.message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {firstError?.line && (
          <button
            type="button"
            onClick={handleJumpToError}
            className="flex items-center gap-1 font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Line {firstError.line} <ArrowRight className="size-3" />
          </button>
        )}
        {onOpenLogs && (
          <button
            type="button"
            onClick={onOpenLogs}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-destructive/20 hover:bg-destructive/30 font-medium transition-colors"
          >
            <Terminal className="size-3" /> Logs
          </button>
        )}
      </div>
    </div>
  );
}
