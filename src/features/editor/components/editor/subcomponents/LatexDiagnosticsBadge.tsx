'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Wand2,
  HelpCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useSettingsStore, usePageStore } from '@/features/editor/store';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { manuscriptService, type ErrorExplanationDto } from '@/features/editor/services/manuscript.service';
import type { LatexLintDiagnostic } from '@/features/editor/utils/latex-linter.util';

export function LatexDiagnosticsBadge() {
  const { linterEnabled, toggleLinterEnabled } = useSettingsStore();

  const [diagnostics, setDiagnostics] = useState<LatexLintDiagnostic[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [selectedExplanation, setSelectedExplanation] = useState<ErrorExplanationDto | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Safely retrieve editor instance if mounted
  let editorInstance: { getContent: () => string; engine: any } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    editorInstance = useEditorInstance();
  } catch {
    editorInstance = null;
  }

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
        setSelectedExplanation(null);
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
    editorCommandBus.dispatch({
      type: 'editor:jump-to-line',
      line: diag.startLineNumber,
      highlight: 'error',
    });
    setIsOpen(false);
  };

  const handleAutoFix = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let currentSource = editorInstance?.getContent() ?? '';
    if (!currentSource) {
      const pageContent = usePageStore.getState().currentPage?.content;
      currentSource = typeof pageContent === 'string' ? pageContent : (pageContent as any)?.text || '';
    }

    if (!currentSource.trim()) {
      toast.info('Document is empty');
      return;
    }

    setIsAutoFixing(true);
    try {
      const result = await manuscriptService.diagnostics.autoFix(currentSource);
      if (result.isFixed && result.fixedSource) {
        if (editorInstance?.engine) {
          editorInstance.engine.setContent(result.fixedSource);
        }
        editorCommandBus.dispatch({
          type: 'editor:set-content',
          content: result.fixedSource,
        });

        const fixCount = result.appliedFixes?.length || 1;
        toast.success(`Successfully auto-fixed ${fixCount} LaTeX syntax issue${fixCount > 1 ? 's' : ''}`);
      } else {
        toast.info('No auto-fixable syntax issues found');
      }
    } catch (err: any) {
      console.error('Auto-fix failed:', err);
      toast.error(err?.message || 'Failed to auto-fix document');
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleExplain = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    setIsLoadingExplanation(true);
    try {
      const expl = await manuscriptService.diagnostics.getExplanation(code);
      setSelectedExplanation(expl);
    } catch (err: any) {
      console.warn('Failed to load error explanation:', err);
      toast.error(`No explanation found for rule ${code}`);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  if (totalIssues === 0) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center select-none" ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSelectedExplanation(null);
        }}
        className={cn(
          'flex items-center gap-1.5 h-6 px-2 rounded-md text-11 font-semibold transition-colors cursor-pointer',
          errorCount > 0
            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30'
            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30',
        )}
        title={`Syntax issues (${totalIssues})`}
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

      {/* Diagnostics Problems Popover */}
      {isOpen && totalIssues > 0 && (
        <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-[9999] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border bg-background flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
              <AlertCircle className="size-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Diagnostics ({totalIssues})</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isAutoFixing}
                onClick={handleAutoFix}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-11 font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Auto-fix syntax"
              >
                {isAutoFixing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Wand2 className="size-3" />
                )}
                <span>Auto Fix</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSelectedExplanation(null);
                }}
                className="p-1 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Explanation View */}
          {selectedExplanation ? (
            <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <button
                  type="button"
                  onClick={() => setSelectedExplanation(null)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to issues</span>
                </button>
                <span className="text-11 font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {selectedExplanation.code}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  {selectedExplanation.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {selectedExplanation.explanation || selectedExplanation.summary}
                </p>
              </div>

              {selectedExplanation.commonCauses && selectedExplanation.commonCauses.length > 0 && (
                <div className="space-y-1">
                  <span className="text-11 uppercase font-mono tracking-wider font-semibold text-muted-foreground">
                    Common Causes
                  </span>
                  <ul className="text-xs space-y-1 text-foreground/90 pl-3 list-disc">
                    {selectedExplanation.commonCauses.map((cause, i) => (
                      <li key={i}>{cause}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedExplanation.suggestedFix && (
                <div className="space-y-1 bg-emerald-500/10 border border-emerald-500/20 rounded p-2 text-11">
                  <span className="text-10 uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">
                    Suggested Remedy
                  </span>
                  <p className="text-foreground/90 mt-0.5">
                    {selectedExplanation.suggestedFix}
                  </p>
                </div>
              )}

              {selectedExplanation.exampleSnippet && (
                <div className="space-y-1">
                  <span className="text-10 uppercase tracking-wider font-semibold text-muted-foreground">
                    Example / Fix Snippet
                  </span>
                  <pre className="p-2 rounded bg-muted/80 text-foreground font-mono text-10 overflow-x-auto whitespace-pre-wrap">
                    {selectedExplanation.exampleSnippet}
                  </pre>
                </div>
              )}

              {selectedExplanation.documentationUrl && (
                <a
                  href={selectedExplanation.documentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-11 text-primary hover:underline pt-1"
                >
                  <span>Learn more in LaTeX docs</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ) : (
            /* Diagnostic Items List */
            <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
              {diagnostics.map((diag, index) => {
                const isErr = diag.severity === 'error';
                return (
                  <div
                    key={`${diag.code}-${diag.startLineNumber}-${diag.startColumn}-${index}`}
                    className="p-2.5 hover:bg-muted/50 transition-colors flex items-start justify-between gap-2 group"
                  >
                    <div
                      onClick={() => handleJumpToIssue(diag)}
                      className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
                    >
                      {isErr ? (
                        <AlertCircle className="size-3.5 text-rose-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-11 font-mono text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Line {diag.startLineNumber}:{diag.startColumn}
                          </span>
                          <span className="text-10 px-1 rounded-sm bg-muted font-mono">
                            {diag.code}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 mt-0.5 leading-snug break-words">
                          {diag.message}
                        </p>
                        {diag.suggestions && diag.suggestions.length > 0 && (
                          <div className="mt-1 text-11 text-emerald-600 dark:text-emerald-400 font-mono">
                            Quick fix: {diag.suggestions[0]}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleExplain(e, diag.code)}
                        title="Explain this issue"
                        disabled={isLoadingExplanation}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJumpToIssue(diag)}
                        title="Jump to line in editor"
                        className="p-1 rounded text-muted-foreground group-hover:text-foreground cursor-pointer"
                      >
                        <ChevronRight className="size-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between text-11 text-muted-foreground">
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
