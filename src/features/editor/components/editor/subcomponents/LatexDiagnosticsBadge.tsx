'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useDocumentEditorStore, useSettingsStore } from '@/features/editor/store';
import type { LatexLintDiagnostic } from '@/features/editor/utils/latex-linter.util';

export function LatexDiagnosticsBadge() {
  const { scrollToLineRef } = useDocumentEditorStore();
  const { linterEnabled, toggleLinterEnabled } = useSettingsStore();

  const [diagnostics, setDiagnostics] = useState<LatexLintDiagnostic[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return EditorEventBus.on('flux:diagnostics-updated', (data: any) => {
      setDiagnostics(data.diagnostics || []);
      setErrorCount(data.errorCount || 0);
      setWarningCount(data.warningCount || 0);
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!linterEnabled) {
    return null;
  }

  const totalIssues = errorCount + warningCount;

  const handleJumpToIssue = (diag: LatexLintDiagnostic) => {
    scrollToLineRef.current?.(diag.startLineNumber, 'error');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex items-center select-none" ref={popoverRef}>
      {totalIssues === 0 ? (
        <div
          className="flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shrink-0"
          title="LaTeX Syntax OK: No issues detected in current file"
        >
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
          <span className="hidden xl:inline">Syntax OK</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer shadow-2xs',
            errorCount > 0
              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30'
              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30',
          )}
          title="Click to view syntax issues and jump to lines"
        >
          {errorCount > 0 ? (
            <AlertCircle className="size-3 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span>
            {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 's' : ''}`}
            {errorCount > 0 && warningCount > 0 && ', '}
            {warningCount > 0 && `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
          </span>
        </button>
      )}

      {/* Diagnostics Problems Popover */}
      {isOpen && totalIssues > 0 && (
        <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl z-[9999] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertCircle className="size-3.5 text-rose-500" />
              <span>LaTeX Syntax Diagnostics ({totalIssues})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
            {diagnostics.map((diag, index) => {
              const isErr = diag.severity === 'error';
              return (
                <div
                  key={`${diag.code}-${diag.startLineNumber}-${diag.startColumn}-${index}`}
                  onClick={() => handleJumpToIssue(diag)}
                  className="p-2.5 hover:bg-muted/50 transition-colors cursor-pointer group flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {isErr ? (
                      <AlertCircle className="size-3.5 text-rose-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Line {diag.startLineNumber}:{diag.startColumn}
                        </span>
                        <span className="text-[10px] px-1 rounded bg-muted">
                          {diag.code}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/90 mt-0.5 leading-snug break-words">
                        {diag.message}
                      </p>
                      {diag.suggestions && diag.suggestions.length > 0 && (
                        <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                          Quick fix: {diag.suggestions[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-1 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>

          <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Click any item to jump and highlight in editor</span>
            <button
              type="button"
              onClick={() => toggleLinterEnabled()}
              className="hover:underline text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Disable linter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
