'use client';

/**
 * CompilerLogs.tsx
 *
 * Canonical Overleaf-parity Compiler Logs & Output Files Panel (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/CompilerLogs.tsx`
 *
 * Capabilities:
 * - Top Header: [Recompile ▾] + [Back to PDF] button + Overleaf error stepper (F8 / Shift+F8)
 * - Filter Tabs: All logs (count), Errors (count), Warnings (count), Info (count)
 * - Collapsible: > Raw logs accordion
 * - Error entries with AI Error Assist (suggest & apply fixes directly)
 * - Bottom Bar: [Clear cached files] + [Other logs and files ▴]
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLogViewerActions } from './hooks/useLogViewerActions';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { PlaneErrorState, PlaneEmptyState } from '@/shared/components/ui';
import { usePageStore, useCompileStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import {
  manuscriptService,
  listAuxFiles,
  suggestLatexFix,
  type AiErrorFixResult,
  type AuxFileItem,
  type DiagnosticReportDto,
} from '@/features/editor/sdk';

import type {
  LogEntry,
  ParsedLog,
  CompilerLogsProps,
  LogsProps,
  ErrorExplanationDto,
} from '@/features/editor/domain/types';

import {
  parseLatexLog,
  DEFAULT_OUTPUT_FILES,
  CompilerLogEntryRow,
  CompilerLogsHeader,
  CompilerLogsFilterTabs,
  CompilerLogsFooter,
  type TabType,
} from './logs';

export { parseLatexLog };
export type { LogEntry, ParsedLog, CompilerLogsProps, LogsProps, ErrorExplanationDto };

export function CompilerLogs({
  log,
  parsedLog: externalParsedLog,
  onClose,
  onJumpToError,
  onClearCacheAndCompile,
  onCompile,
}: CompilerLogsProps) {
  const projectId = usePageStore((s) => s.projectId);
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const { engine } = useEditorInstance();
  const parsed = useMemo(
    () => externalParsedLog ?? parseLatexLog(log),
    [externalParsedLog, log],
  );

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRawLogsOpen, setIsRawLogsOpen] = useState(false);

  // Enriched Backend Diagnostics Report
  const [enrichedReport, setEnrichedReport] = useState<DiagnosticReportDto | null>(null);

  useEffect(() => {
    if (!log || !log.trim()) {
      setEnrichedReport(null);
      return;
    }
    let isSubscribed = true;
    manuscriptService.diagnostics.parseLog(log)
      .then((report) => {
        if (isSubscribed && report) {
          setEnrichedReport(report);
        }
      })
      .catch(() => {});
    return () => {
      isSubscribed = false;
    };
  }, [log]);

  const enrichEntry = useCallback(
    (e: LogEntry): LogEntry => {
      if (!enrichedReport?.items || enrichedReport.items.length === 0) return e;
      const match = enrichedReport.items.find((item) => {
        if (item.line && e.line && item.line === e.line) return true;
        if (
          e.message &&
          item.message &&
          (item.message.includes(e.message) || e.message.includes(item.message))
        )
          return true;
        return false;
      });
      if (!match) return e;
      return {
        ...e,
        file: match.file || e.file,
        code: match.code || e.code,
        explanation: match.explanation || e.explanation,
        quickFix: match.quickFix || e.quickFix,
      };
    },
    [enrichedReport],
  );

  const handleClearCacheAndCompile = useCallback(() => {
    if (onClearCacheAndCompile) {
      onClearCacheAndCompile();
    } else {
      editorCommandBus.dispatch({ type: 'compiler:trigger', forceClean: true });
    }
  }, [onClearCacheAndCompile]);

  const {
    applyQuickFix,
    applyAiFix,
    downloadFile,
    downloadAllArtifacts,
  } = useLogViewerActions({
    engine,
    projectId,
    onCompile,
    onClearCacheAndCompile: handleClearCacheAndCompile,
  });

  const handleApplyQuickFix = (
    entry: LogEntry,
    quickFix: { description: string; replacementText: string },
  ) => {
    applyQuickFix(entry, quickFix);
  };

  // Auxiliary files list
  const [auxFiles, setAuxFiles] = useState<AuxFileItem[]>([]);
  useEffect(() => {
    if (projectId) {
      listAuxFiles(projectId)
        .then((files) => setAuxFiles(files))
        .catch(() => {});
    }
  }, [projectId]);

  const outputFiles = useMemo(() => {
    if (auxFiles && auxFiles.length > 0) {
      const names = auxFiles.map((f) => f.name);
      return Array.from(new Set([...names, ...DEFAULT_OUTPUT_FILES]));
    }
    return DEFAULT_OUTPUT_FILES;
  }, [auxFiles]);

  const handleDownloadRawLog = useCallback(() => {
    if (!log || !log.trim()) {
      toast.info('Chưa có dữ liệu log biên dịch để tải về');
      return;
    }
    const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.log';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống tệp output.log');
  }, [log]);

  // AI Error Assist state
  const [fixState, setFixState] = useState<
    Record<string, { loading: boolean; result?: AiErrorFixResult; applied?: boolean }>
  >({});

  const getEntryKey = useCallback((entry: LogEntry, index: number) =>
    `${entry.file || ''}-${entry.line || 0}-${entry.message}-${index}`, []);

  const handleSuggestFix = useCallback(async (entry: LogEntry, index: number) => {
    const key = getEntryKey(entry, index);
    if (fixState[key]?.result && !fixState[key].loading) {
      setFixState((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    setFixState((prev) => ({
      ...prev,
      [key]: { loading: true },
    }));

    let surroundingCode = '';
    if (engine && entry.line) {
      const lines = engine.getContent().split('\n');
      const start = Math.max(0, entry.line - 4);
      const end = Math.min(lines.length, entry.line + 3);
      surroundingCode = lines.slice(start, end).join('\n');
    }

    const result = await suggestLatexFix({
      errorMessage: entry.message,
      errorLine: entry.line,
      errorFile: entry.file,
      detail: entry.detail,
      surroundingCode,
    });

    setFixState((prev) => ({
      ...prev,
      [key]: { loading: false, result },
    }));
  }, [engine, fixState, getEntryKey]);

  const handleApplyFix = useCallback((entry: LogEntry, fix: AiErrorFixResult, index: number) => {
    const key = getEntryKey(entry, index);
    applyAiFix(entry, fix, () => {
      setFixState((prev) => ({
        ...prev,
        [key]: { loading: false, applied: true, result: fix },
      }));
    });
  }, [applyAiFix, getEntryKey]);

  // Listen for editor:suggest-fix command from editor CodeMirror gutter or tooltip
  useEffect(() => {
    return editorCommandBus.subscribe('editor:suggest-fix', (cmd) => {
      const { error } = cmd;
      setActiveTab('errors');

      const idx = parsed.errors.findIndex(
        (e) =>
          (error.line && e.line === error.line) ||
          (error.message && (e.message.includes(error.message) || error.message.includes(e.message)))
      );

      const targetIdx = idx !== -1 ? idx : parsed.errors.length > 0 ? 0 : -1;
      if (targetIdx !== -1) {
        const entry = enrichEntry(parsed.errors[targetIdx]);
        handleSuggestFix(entry, targetIdx);
        setTimeout(() => {
          const el = document.getElementById(`log-entry-err-${targetIdx}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    });
  }, [parsed.errors, enrichEntry, handleSuggestFix]);

  const handleEntryClick = useCallback((entry: LogEntry) => {
    if (entry.line) {
      if (onJumpToError) {
        onJumpToError(entry.file, entry.line);
      } else {
        editorCommandBus.dispatch({
          type: 'editor:jump-to-line',
          line: entry.line,
          highlight: 'error',
        });
      }
      toast.info(`Đã chuyển đến dòng ${entry.line}${entry.file ? ` (${entry.file})` : ''}`);
    }
  }, [onJumpToError]);

  // Overleaf-parity error stepping (F8 / Shift+F8)
  const [currentErrorIdx, setCurrentErrorIdx] = useState<number>(0);

  const handleNextError = useCallback(() => {
    if (parsed.errors.length === 0) return;
    const nextIdx = (currentErrorIdx + 1) % parsed.errors.length;
    setCurrentErrorIdx(nextIdx);
    const err = parsed.errors[nextIdx];
    handleEntryClick(err);
    const el = document.getElementById(`log-entry-err-${nextIdx}`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [currentErrorIdx, parsed.errors, handleEntryClick]);

  const handlePrevError = useCallback(() => {
    if (parsed.errors.length === 0) return;
    const prevIdx = (currentErrorIdx - 1 + parsed.errors.length) % parsed.errors.length;
    setCurrentErrorIdx(prevIdx);
    const err = parsed.errors[prevIdx];
    handleEntryClick(err);
    const el = document.getElementById(`log-entry-err-${prevIdx}`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [currentErrorIdx, parsed.errors, handleEntryClick]);

  // Global F8 / Shift+F8 keyboard shortcut for stepping through compilation errors
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevError();
        } else {
          handleNextError();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNextError, handlePrevError]);

  // Sync with external error-stepped events from navigation coordinator
  useEffect(() => {
    const unsubStepped = editorCommandBus.subscribe('editor:error-stepped', (cmd) => {
      if (cmd.errorIndex !== undefined && cmd.errorIndex >= 0) {
        setCurrentErrorIdx(cmd.errorIndex);
        const el = document.getElementById(`log-entry-err-${cmd.errorIndex}`);
        el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      }
    });

    return () => {
      unsubStepped();
    };
  }, []);

  const totalLogsCount = parsed.errors.length + parsed.warnings.length + parsed.badBoxes.length;

  return (
    <div className="h-full w-full flex flex-col bg-canvas text-foreground select-none overflow-hidden font-sans">
      {/* ── Top Header Toolbar (Overleaf 1:1 Parity) ── */}
      <CompilerLogsHeader
        onCompile={onCompile}
        onClearCacheAndCompile={onClearCacheAndCompile}
        onClose={onClose}
        totalErrors={parsed.errors.length}
        currentErrorIdx={currentErrorIdx}
        onPrevError={handlePrevError}
        onNextError={handleNextError}
      />

      {/* ── Filter Tabs (All logs, Errors, Warnings, Info) ── */}
      <CompilerLogsFilterTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalLogsCount={totalLogsCount}
        errorsCount={parsed.errors.length}
        warningsCount={parsed.warnings.length}
        badBoxesCount={parsed.badBoxes.length}
      />

      {/* ── Main Body ── */}
      {compileStatus === 'error' && parsed.errors.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-transparent">
          <PlaneErrorState
            title="Compilation failed"
            description="The LaTeX compiler encountered an error or terminated prematurely. Check the raw logs below to diagnose the issue."
            error={log ? new Error(log.slice(-1000)) : new Error('LaTeX engine failed to compile document.')}
          />
        </div>
      ) : activeTab === 'all' && totalLogsCount === 0 && !log ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-transparent">
          <PlaneEmptyState
            variant="review"
            title="No compilation issues"
            description="Your document compiled cleanly with zero errors or warnings."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8 px-3 rounded-md text-xs font-medium gap-1.5 cursor-pointer shadow-none"
              >
                <ChevronLeft className="size-3.5 shrink-0" />
                <span>Back to PDF preview</span>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-background divide-y divide-border/60 font-mono">
          {/* Compilation Error Banner (when errors exist) */}
          {parsed.errors.length > 0 && (activeTab === 'all' || activeTab === 'errors') && (
            <div className="flex items-center justify-between p-3 bg-destructive/5 text-destructive text-xs animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                <span className="font-medium text-foreground">
                  <strong className="text-destructive font-semibold">
                    {parsed.errors.length} compilation {parsed.errors.length === 1 ? 'error' : 'errors'}
                  </strong>{' '}
                  detected in this build
                </span>
              </div>
              {parsed.errors.some((e) => e.line) && (
                <button
                  type="button"
                  onClick={() => {
                    const first = parsed.errors.find((e) => e.line);
                    if (first) handleEntryClick(first);
                  }}
                  className="px-2.5 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                >
                  Jump to first error
                </button>
              )}
            </div>
          )}

          {/* Collapsible: > Raw logs accordion (Overleaf 1:1 Match) */}
          <div id="raw-latex-logs" className="bg-background">
            <button
              type="button"
              aria-expanded={isRawLogsOpen}
              aria-controls="raw-latex-logs-content"
              onClick={() => setIsRawLogsOpen((prev) => !prev)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left font-medium text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronRight
                className={cn('size-3.5 text-muted-foreground transition-transform duration-150', isRawLogsOpen && 'rotate-90')}
              />
              <span>Raw logs</span>
            </button>
            {isRawLogsOpen && (
              <pre id="raw-latex-logs-content" className="p-3 border-t border-border/60 bg-muted/20 font-mono text-12 text-foreground/90 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto select-text">
                {log || 'No compilation logs recorded yet.'}
              </pre>
            )}
          </div>

          {/* Diagnostic Entries List */}
          <div className="bg-background">
            {/* Errors */}
            {(activeTab === 'all' || activeTab === 'errors') &&
              parsed.errors.map((e, i) => {
                const enriched = enrichEntry(e);
                const key = getEntryKey(enriched, i);
                const state = fixState[key];
                return (
                  <CompilerLogEntryRow
                    key={`err-${i}`}
                    id={`log-entry-err-${i}`}
                    type="error"
                    entry={enriched}
                    onClick={() => handleEntryClick(enriched)}
                    onSuggestFix={() => handleSuggestFix(enriched, i)}
                    isFixLoading={state?.loading}
                    fixResult={state?.result}
                    isFixApplied={state?.applied}
                    onApplyFix={(_entry, fix) => handleApplyFix(enriched, fix, i)}
                    onApplyQuickFix={handleApplyQuickFix}
                  />
                );
              })}

            {/* Warnings */}
            {(activeTab === 'all' || activeTab === 'warnings') &&
              parsed.warnings.map((e, i) => {
                const enriched = enrichEntry(e);
                return (
                  <CompilerLogEntryRow
                    key={`warn-${i}`}
                    type="warning"
                    entry={enriched}
                    onClick={() => handleEntryClick(enriched)}
                    onApplyQuickFix={handleApplyQuickFix}
                  />
                );
              })}

            {/* Info / Bad boxes */}
            {(activeTab === 'all' || activeTab === 'info') &&
              parsed.badBoxes.map((e, i) => {
                const enriched = enrichEntry(e);
                return (
                  <CompilerLogEntryRow
                    key={`info-${i}`}
                    type="badbox"
                    entry={enriched}
                    onClick={() => handleEntryClick(enriched)}
                    onApplyQuickFix={handleApplyQuickFix}
                  />
                );
              })}

            {/* Empty States */}
            {activeTab === 'errors' && parsed.errors.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation errors"
                  description="Your document compiled without any LaTeX errors."
                />
              </div>
            )}
            {activeTab === 'warnings' && parsed.warnings.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation warnings"
                  description="No layout warnings or unresolved reference warnings found."
                />
              </div>
            )}
            {activeTab === 'info' && parsed.badBoxes.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No layout notices"
                  description="No bad boxes or formatting diagnostics reported."
                />
              </div>
            )}
            {activeTab === 'all' && totalLogsCount === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation issues"
                  description="Your document compiled cleanly with zero errors or warnings."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Action Bar (Clear cached files & Other logs and files) ── */}
      <CompilerLogsFooter
        onClearCacheAndCompile={handleClearCacheAndCompile}
        outputFiles={outputFiles}
        onDownloadFile={downloadFile}
        onDownloadAll={downloadAllArtifacts}
        onDownloadRawLog={handleDownloadRawLog}
      />
    </div>
  );
}

export const Logs = CompilerLogs;
export const LogPanel = CompilerLogs;
export default CompilerLogs;
