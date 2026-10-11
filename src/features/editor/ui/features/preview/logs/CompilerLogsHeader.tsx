'use client';

import React from 'react';
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { CompileButton } from '../CompileButton';

export interface CompilerLogsHeaderProps {
  onCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onClose?: () => void;
  totalErrors: number;
  currentErrorIdx: number;
  onPrevError: () => void;
  onNextError: () => void;
}

export function CompilerLogsHeader({
  onCompile,
  onClearCacheAndCompile,
  onClose,
  totalErrors,
  currentErrorIdx,
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
          aria-label="View PDF"
          className="h-7 px-2.5 flex items-center gap-1.5 rounded-md border border-border bg-canvas hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" />
          <span>View PDF</span>
        </button>
      </div>

      {/* ── Overleaf Error Stepper (Next Error / Previous Error / F8) ── */}
      {totalErrors > 0 && (
        <div className="flex items-center gap-1.5 font-sans">
          <span className="text-xs text-muted-foreground font-mono">
            Error {currentErrorIdx + 1} of {totalErrors} ({currentErrorIdx + 1}/{totalErrors} lỗi)
          </span>
          <div className="flex items-center rounded-md bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={onPrevError}
              aria-label="Lỗi trước (Shift+F8) / Previous error"
              title="Previous error (Shift+F8)"
              className="size-6 flex items-center justify-center hover:bg-background rounded-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onNextError}
              aria-label="Lỗi tiếp theo (F8) / Next error"
              title="Next error (F8)"
              className="size-6 flex items-center justify-center hover:bg-background rounded-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
