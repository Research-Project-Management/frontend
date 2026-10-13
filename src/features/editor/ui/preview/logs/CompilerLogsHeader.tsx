'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CompileButton } from '../CompileButton';

export interface CompilerLogsHeaderProps {
  onCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onClose?: () => void;
  totalErrors?: number;
  currentErrorIdx?: number;
  onPrevError?: () => void;
  onNextError?: () => void;
}

export function CompilerLogsHeader({
  onCompile,
  onClearCacheAndCompile,
  onClose,
  totalErrors = 0,
  currentErrorIdx = 0,
  onPrevError,
  onNextError,
}: CompilerLogsHeaderProps) {
  return (
    <header className="h-9 px-2 border-b border-border bg-surface flex items-center justify-between gap-1.5 shrink-0 font-sans select-none">
      <div className="flex items-center gap-1.5">
        {onCompile && (
          <CompileButton
            onCompile={onCompile}
            onClearCacheAndCompile={onClearCacheAndCompile}
          />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to PDF"
          className="h-7 px-2.5 flex items-center gap-1.5 rounded-md border border-border bg-canvas hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Back to PDF</span>
        </button>
      </div>

      {totalErrors > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="compiler-error-stepper">
          <span className="font-medium text-foreground select-none">
            Error {currentErrorIdx + 1} of {totalErrors}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onPrevError}
              aria-label="Previous error (Shift+F8)"
              title="Previous error (Shift+F8)"
              className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-foreground transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onNextError}
              aria-label="Next error (F8)"
              title="Next error (F8)"
              className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-foreground transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
